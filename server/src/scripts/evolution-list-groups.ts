import { config } from "../config/index.js";
import { fetchAllGroups } from "../services/evolution.service.js";

async function main() {
  const instanceName = process.argv[2] || config.evolutionInstance;
  if (!instanceName) {
    throw new Error("No Evolution instance configured or provided");
  }

  const groups = await fetchAllGroups(instanceName);
  if (groups.length === 0) {
    console.log("No groups found.");
    return;
  }

  for (const group of groups) {
    console.log(`${group.subject || "Ohne Namen"} | ${group.id} | Mitglieder: ${group.size ?? "-"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
