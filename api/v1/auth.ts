import type { ApiRequest, ApiResponse } from "../../server/_lib/http.js";
import { dispatch } from "../../server/api/dispatch.js";
import login from "../../server/v1/auth/login.js";
import logout from "../../server/v1/auth/logout.js";
import register from "../../server/v1/auth/register.js";
import session from "../../server/v1/auth/session.js";
import sessions from "../../server/v1/auth/sessions.js";
import revokeSession from "../../server/v1/auth/sessions/revoke.js";
import stepUp from "../../server/v1/auth/step-up.js";
import recoveryCodes from "../../server/v1/auth/recovery-codes.js";
import totpStart from "../../server/v1/auth/mfa/totp/start.js";
import totpConfirm from "../../server/v1/auth/mfa/totp/confirm.js";
import passkeyRegisterOptions from "../../server/v1/auth/mfa/passkey/register/options.js";
import passkeyRegisterVerify from "../../server/v1/auth/mfa/passkey/register/verify.js";
import passkeyStepUpOptions from "../../server/v1/auth/mfa/passkey/step-up/options.js";
import passkeyStepUpVerify from "../../server/v1/auth/mfa/passkey/step-up/verify.js";
import { startNexussAuth, handleNexussCallback, loginWithNexussToken, linkNexussIdentity } from "../../server/v1/auth/nexuss.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await dispatch(req, res, {
    login,
    logout,
    register,
    session,
    list_sessions: sessions,
    rotate_session: sessions,
    revoke_session: revokeSession,
    step_up: stepUp,
    recovery_codes: recoveryCodes,
    totp_start: totpStart,
    totp_confirm: totpConfirm,
    passkey_register_options: passkeyRegisterOptions,
    passkey_register_verify: passkeyRegisterVerify,
    passkey_step_up_options: passkeyStepUpOptions,
    passkey_step_up_verify: passkeyStepUpVerify,
    nexuss_start: startNexussAuth,
    nexuss_callback: handleNexussCallback,
    nexuss_token_login: loginWithNexussToken,
    nexuss_link: linkNexussIdentity,
  });
}
