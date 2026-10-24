import { JOIN_KEY_ALPHABET } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { AppError } from "../../common/app_error";
import { JOIN_KEY_ATTEMPTS, generate_join_key, with_unique_join_key } from "./join_key";

describe("generate_join_key", () => {
  it("makes 6 characters from the readable alphabet", () => {
    for (let run = 0; run < 200; run += 1) {
      expect(generate_join_key()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });

  it("never uses 0, O, 1, I or L", () => {
    expect(JOIN_KEY_ALPHABET).not.toMatch(/[0O1IL]/);
    const keys = Array.from({ length: 500 }, () => generate_join_key()).join("");
    expect(keys).not.toMatch(/[0O1IL]/);
  });

  it("picks each character with the given random index", () => {
    let call = 0;
    const key = generate_join_key(() => {
      call += 1;
      return call - 1;
    });
    expect(key).toBe(JOIN_KEY_ALPHABET.slice(0, 6));
  });
});

describe("with_unique_join_key", () => {
  it("retries with a new key until the save succeeds", async () => {
    const keys = ["AAAAAA", "BBBBBB", "CCCCCC"];
    const tried: string[] = [];
    const saved = await with_unique_join_key(
      (key) => {
        tried.push(key);
        return Promise.resolve(key === "CCCCCC" ? { key } : undefined);
      },
      () => keys.shift() ?? "ZZZZZZ",
    );
    expect(tried).toEqual(["AAAAAA", "BBBBBB", "CCCCCC"]);
    expect(saved).toEqual({ key: "CCCCCC" });
  });

  it("gives up after too many clashes", async () => {
    let attempts = 0;
    const failing = with_unique_join_key(() => {
      attempts += 1;
      return Promise.resolve(undefined);
    });
    await expect(failing).rejects.toBeInstanceOf(AppError);
    expect(attempts).toBe(JOIN_KEY_ATTEMPTS);
  });
});
