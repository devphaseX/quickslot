import { getEnv } from "@/server/internals/env";
import { Job, Queue } from "bullmq";

export enum TemplateType {
  VERIFY_USER_EMAIL = "verify_user_email",
  VERIFY_FORGOT_PASSWORD = "verify_forgot_password",
}

export type TemplatePayload = {
  [TemplateType.VERIFY_USER_EMAIL]: {
    email: string;
    name: string;
    token: string;
  };

  [TemplateType.VERIFY_FORGOT_PASSWORD]: {
    email: string;
    name: string;
    token: string;
  };
};

export type SendMailPayload<T extends TemplateType> = {
  to: Array<{ email: string; name: string }>;
  from?: { email: string; name: string };
  subject: string;
  template: T;
  data: TemplatePayload[T];
};

const queue = new Queue<SendMailPayload<TemplateType>>("email-jobs", {
  connection: {
    url: getEnv("REDIS_URL"),
  },
});

export async function sendEmailJob<T extends TemplateType>(
  data: SendMailPayload<T>,
) {
  queue.add("send-email-job", data);
}
