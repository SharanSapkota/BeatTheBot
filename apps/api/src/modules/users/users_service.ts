import type { UpdateMeRequest, UserSummary } from "@voita_kone/shared_types";
import { unauthorized } from "../auth/auth_context";
import { to_user } from "../auth/auth_service";
import type { UsersRepository } from "./users_repository";

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async get_me(user_id: string): Promise<UserSummary> {
    const user = await this.repository.find_user(user_id);
    if (!user) {
      throw unauthorized();
    }
    return { ...to_user(user), total_points: await this.repository.sum_points(user_id) };
  }

  async update_me(user_id: string, change: UpdateMeRequest): Promise<UserSummary> {
    if (change.display_name !== undefined) {
      const updated = await this.repository.update_display_name(user_id, change.display_name);
      if (!updated) {
        throw unauthorized();
      }
    }
    return this.get_me(user_id);
  }

  async delete_me(user_id: string): Promise<void> {
    await this.repository.delete_user(user_id);
  }
}
