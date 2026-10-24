import { describe, expect, it } from "vitest";
import type { UserRow } from "../auth/auth_repository";
import type { UsersRepository } from "./users_repository";
import { UsersService } from "./users_service";

const USER: UserRow = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Mika",
  role: "player",
};

class FakeUsersRepository implements UsersRepository {
  deleted: string[] = [];

  constructor(private user: UserRow | undefined) {}

  find_user(): Promise<UserRow | undefined> {
    return Promise.resolve(this.user);
  }

  sum_points(): Promise<number> {
    return Promise.resolve(38);
  }

  update_display_name(_user_id: string, display_name: string): Promise<UserRow | undefined> {
    this.user = this.user ? { ...this.user, display_name } : undefined;
    return Promise.resolve(this.user);
  }

  delete_user(user_id: string): Promise<void> {
    this.deleted.push(user_id);
    return Promise.resolve();
  }
}

describe("UsersService", () => {
  it("returns the user with their total points", async () => {
    const me = await new UsersService(new FakeUsersRepository(USER)).get_me(USER.id);

    expect(me).toEqual({ ...USER, total_points: 38 });
  });

  it("renames the user", async () => {
    const me = await new UsersService(new FakeUsersRepository(USER)).update_me(USER.id, {
      display_name: "MikaK",
    });

    expect(me.display_name).toBe("MikaK");
  });

  it("returns 401 UNAUTHORIZED for a user that no longer exists", async () => {
    const service = new UsersService(new FakeUsersRepository(undefined));

    await expect(service.get_me(USER.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(service.update_me(USER.id, { display_name: "x" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("deletes the user", async () => {
    const repository = new FakeUsersRepository(USER);

    await new UsersService(repository).delete_me(USER.id);

    expect(repository.deleted).toEqual([USER.id]);
  });
});
