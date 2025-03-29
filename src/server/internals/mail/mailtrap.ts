import { Address, Mail, MailtrapClient } from "mailtrap";
import { getEnv } from "../env";
import { isProd } from "../utils";

const client = new MailtrapClient({
  token: getEnv("MAIL_TRAP_API_KEY"),
  accountId: Number(getEnv("MAIL_TRAP_ACCOUNT_ID")),
  ...(!isProd ? { testInboxId: 2350607 } : null),
});

export type SendMailProps = Omit<Mail, "from"> & { from?: Address };
export function sendMail(props: SendMailProps) {
  const sender: Address = props.from ?? {
    name: getEnv("MAIL_SENDER_NAME"),
    email: getEnv("MAIL_SENDER_EMAIL"),
  };

  // return !isProd
  //   ? client.testing.messages({ ...props, from: sender } as Mail)
  //   : client.send({ ...props, from: sender } as Mail);
}
