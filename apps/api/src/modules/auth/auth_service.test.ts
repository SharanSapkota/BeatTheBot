import { describe, expect, it } from "vitest";
import type { AuthRepository, NewDeviceUser, SessionRow, UserRow } from "./auth_repository";
import { AuthService } from "./auth_service";
import { hash_session_token } from "./session_token";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const USER: UserRow = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Mika",
  role: "user",
};

class FakeAuthRepository implements AuthRepository {
  created: NewDeviceUser | undefined;
  sessions = new Map<string, SessionRow>();
  touched: string[] = [];
  revoked: string[] = [];

  create_device_user(input: NewDeviceUser): Promise<UserRow> {
    this.created = input;
    this.sessions.set(input.token_hash, {
      session_id: "session-1",
      expires_at: input.expires_at,
      revoked_at: null,
      user: { ...USER, display_name: input.display_name },
    });
    return Promise.resolve({ ...USER, display_name: input.display_name });
  }

  find_session(token_hash: string): Promise<SessionRow | undefined> {
    return Promise.resolve(this.sessions.get(token_hash));
  }

  touch_session(session_id: string): Promise<void> {
    this.touched.push(session_id);
    return Promise.resolve();
  }

  revoke_session(session_id: string): Promise<void> {
    this.revoked.push(session_id);
    return Promise.resolve();
  }
}

function create_service(now: () => Date = () => NOW) {
  const repository = new FakeAuthRepository();
  return { repository, service: new AuthService(repository, now) };
}

describe("AuthService.sign_in_device", () => {
  it("creates a device user with a 90-day session and stores only the token hash", async () => {
    const { repository, service } = create_service();

    const result = await service.sign_in_device("Mika", "test-agent");

    expect(result.user).toEqual({ ...USER, display_name: "Mika" });
    expect(result.token.length).toBeGreaterThanOrEqual(43);
    expect(repository.created?.token_hash).toBe(hash_session_token(result.token));
    expect(repository.created?.token_hash).not.toBe(result.token);
    expect(repository.created?.expires_at.toISOString()).toBe("2027-01-22T12:00:00.000Z");
    expect(repository.created?.user_agent).toBe("test-agent");
  });
});

describe("AuthService.authenticate", () => {
  it("returns the user of a valid token and touches the session at most once an hour", async () => {
    let now = NOW;
    const { repository, service } = create_service(() => now);
    const { token } = await service.sign_in_device("Mika", null);

    expect(await service.authenticate(token)).toEqual({
      user_id: USER.id,
      session_id: "session-1",
      display_name: "Mika",
      role: "user",
    });
    now = new Date(NOW.getTime() + 10 * 60 * 1000);
    await service.authenticate(token);
    now = new Date(NOW.getTime() + 61 * 60 * 1000);
    await service.authenticate(token);
    expect(repository.touched).toEqual(["session-1", "session-1"]);
  });

  it("rejects unknown, revoked and expired tokens with 401 UNAUTHORIZED", async () => {
    let now = NOW;
    const { repository, service } = create_service(() => now);
    const { token } = await service.sign_in_device("Mika", null);
    const unauthorized = { code: "UNAUTHORIZED", http_status: 401 };

    await expect(service.authenticate("not-a-token")).rejects.toMatchObject(unauthorized);

    now = new Date("2027-01-22T12:00:00.000Z");
    await expect(service.authenticate(token)).rejects.toMatchObject(unauthorized);

    now = NOW;
    const session = repository.sessions.get(hash_session_token(token));
    if (session) {
      session.revoked_at = NOW;
    }
    await expect(service.authenticate(token)).rejects.toMatchObject(unauthorized);
  });
});

describe("AuthService.logout", () => {
  it("revokes the session", async () => {
    const { repository, service } = create_service();

    await service.logout("session-1");

    expect(repository.revoked).toEqual(["session-1"]);
  });
});
