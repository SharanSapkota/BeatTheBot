import {
  api_error_schema,
  auth_result_response_schema,
  highlight_upload_status_response_schema,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UPLOAD_REASONS } from "../../common/upload_dir";
import { create_test_app } from "../../test_helpers/create_test_app";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({
  db,
  config: {
    upload_status: { file_uploads: false, reason: UPLOAD_REASONS.not_set, directory: null },
  },
});
const path = "/api/v1/admin/highlights/upload_status";

let editor_token: string;
let player_token: string;

async function sign_in(display_name: string): Promise<{ token: string; user_id: string }> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  const { data } = auth_result_response_schema.parse(response.body);
  return { token: `Bearer ${data.token}`, user_id: data.user.id };
}

beforeAll(async () => {
  await reset_test_database(db);
  const editor = await sign_in("Desk editor");
  await db.updateTable("users").set({ role: "editor" }).where("id", "=", editor.user_id).execute();
  editor_token = editor.token;
  player_token = (await sign_in("Just a fan")).token;
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("GET /api/v1/admin/highlights/upload_status", () => {
  it("tells an editor that only video URLs work, and why", async () => {
    const response = await request(app).get(path).set("Authorization", editor_token);

    expect(response.status).toBe(200);
    expect(highlight_upload_status_response_schema.parse(response.body).data).toEqual({
      file_uploads: false,
      reason: UPLOAD_REASONS.not_set,
    });
  });

  it("is 401 for anonymous readers and 403 for fans", async () => {
    const anonymous = await request(app).get(path);
    const fan = await request(app).get(path).set("Authorization", player_token);

    expect(anonymous.status).toBe(401);
    expect(fan.status).toBe(403);
    expect(api_error_schema.parse(fan.body).error.code).toBe("FORBIDDEN");
  });
});
