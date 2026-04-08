import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import type { Request, Response, NextFunction } from "express";
import { validateFileType } from "../middleware/fileValidation.js";

function createMockReq(filename: string, path: string): Partial<Request> {
  return {
    file: {
      originalname: filename,
      path,
      fieldname: "file",
      encoding: "7bit",
      mimetype: "application/octet-stream",
      size: 1024,
      destination: "",
      filename: "",
      buffer: Buffer.alloc(0),
      stream: null as any,
    },
  };
}

describe("File Validation Middleware", () => {
  it("should pass when no file is uploaded", () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    validateFileType(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should pass .rec files without magic byte check", () => {
    const req = createMockReq("match.rec", "/tmp/test") as Request;
    const res = {} as Response;
    const next = vi.fn();

    validateFileType(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should pass .dem files without magic byte check", () => {
    const req = createMockReq("demo.dem", "/tmp/test") as Request;
    const res = {} as Response;
    const next = vi.fn();

    validateFileType(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
