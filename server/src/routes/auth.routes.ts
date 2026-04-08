import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { authenticate } from "../middleware/auth.js";
import { generateUniqueNumericId } from "../services/numericId.service.js";
import { ensureTeamExists } from "../services/team.service.js";

export const authRouter = Router();

function generateTokens(userId: string) {
  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
  const refreshToken = jwt.sign({ userId, type: "refresh" }, config.jwtSecret, { expiresIn: config.jwtRefreshExpiresIn as any });
  return { token, refreshToken };
}

function setTokenCookies(res: any, token: string, refreshToken: string) {
  const isHttps = config.appUrl.startsWith("https://");
  res.cookie("token", token, { httpOnly: true, secure: isHttps, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: isHttps, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
}

authRouter.get("/discord", (_req, res) => {
  const scopes = ["identify", "email", "guilds", "guilds.members.read"];
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordCallbackUrl,
    response_type: "code",
    scope: scopes.join(" "),
    prompt: "consent",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

authRouter.get("/discord/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) { res.redirect(config.appUrl + "/access-denied?reason=login_failed"); return; }

    // Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: config.discordCallbackUrl,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) { res.redirect(config.appUrl + "/access-denied?reason=login_failed"); return; }
    const accessToken: string = tokenData.access_token;

    // Fetch Discord user
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const discordUser = await userRes.json();
    if (!discordUser.id) { res.redirect(config.appUrl + "/access-denied?reason=login_failed"); return; }

    // Guild & Role check
    let memberRoles: string[] = [];
    const isAdminUser = config.adminUserIds.includes(discordUser.id);

    if (config.requiredGuildId) {
      try {
        const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${config.requiredGuildId}/member`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!memberRes.ok) {
          // Admin users (via ADMIN_USER_IDS) can bypass guild membership
          if (isAdminUser) {
            logger.info({ discordId: discordUser.id }, "[Auth] Admin user bypassed guild check");
          } else {
            logger.warn({ discordId: discordUser.id, status: memberRes.status, statusText: memberRes.statusText }, "[Auth] Guild member check failed");
            res.redirect(config.appUrl + "/access-denied?reason=not_in_server");
            return;
          }
        } else {
          const memberData = await memberRes.json();
          memberRoles = memberData.roles || [];
        }

        if (config.allowedRoleIds.length > 0 && !isAdminUser) {
          const hasAllowedRole = config.allowedRoleIds.some(roleId => memberRoles.includes(roleId));
          if (!hasAllowedRole) {
            logger.warn({ discordId: discordUser.id, roles: memberRoles }, "[Auth] Missing required role");
            res.redirect(config.appUrl + "/access-denied?reason=missing_role");
            return;
          }
        }
      } catch (err) {
        if (isAdminUser) {
          logger.info({ discordId: discordUser.id }, "[Auth] Admin user bypassed guild check (fetch error)");
        } else {
          logger.error(err, "[Auth] Guild member check error");
          res.redirect(config.appUrl + "/access-denied?reason=not_in_server");
          return;
        }
      }
    }

    // Admin check: via role IDs OR via user IDs
    const hasAdminRole = config.adminRoleIds.length > 0 && config.adminRoleIds.some(roleId => memberRoles.includes(roleId));
    const isDiscordAdmin = hasAdminRole || isAdminUser;

    const teamId = await ensureTeamExists();

    let user = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
    if (!user) {
      const numericId = await generateUniqueNumericId();

      user = await prisma.user.create({
        data: {
          numericId,
          discordId: discordUser.id,
          username: discordUser.username,
          displayName: discordUser.global_name || discordUser.username,
          email: discordUser.email || null,
          isAdmin: isDiscordAdmin,
          avatarUrl: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith("a_") ? "gif" : "png"}`
            : null,
          discordAccessToken: accessToken,
        },
      });

      const role = isDiscordAdmin ? "ADMIN" : "PLAYER";
      await prisma.teamMember.create({ data: { userId: user.id, teamId, role: role as any } });
    } else {
      const updateData: any = {
        displayName: discordUser.global_name || discordUser.username,
        avatarUrl: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith("a_") ? "gif" : "png"}`
          : null,
        discordAccessToken: accessToken,
      };
      if (discordUser.email) updateData.email = discordUser.email;
      if (isDiscordAdmin && !user.isAdmin) updateData.isAdmin = true;
      user = await prisma.user.update({ where: { id: user.id }, data: updateData });

      const membership = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: user.id, teamId } } });
      if (!membership) {
        await prisma.teamMember.create({ data: { userId: user.id, teamId, role: isDiscordAdmin ? "ADMIN" : "PLAYER" } });
      }
    }

    const { token, refreshToken } = generateTokens(user.id);
    setTokenCookies(res, token, refreshToken);
    res.redirect(config.appUrl + "/dashboard");
  } catch (error) {
    console.error("[Auth] Error:", error);
    res.redirect(config.appUrl + "/access-denied?reason=login_failed");
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) { res.status(401).json({ success: false, error: "No refresh token" }); return; }
    const decoded = jwt.verify(refreshToken, config.jwtSecret) as { userId: string; type: string };
    if (decoded.type !== "refresh") { res.status(401).json({ success: false, error: "Invalid token type" }); return; }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) { res.status(401).json({ success: false, error: "User not found" }); return; }
    const tokens = generateTokens(user.id);
    setTokenCookies(res, tokens.token, tokens.refreshToken);
    res.json({ success: true, data: { token: tokens.token } });
  } catch (error) { next(error); }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out" });
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});
