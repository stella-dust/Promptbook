import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { fail } from "./errors";
export type AuthConfig = {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  OWNER_EMAIL?: string;
};
export async function authenticate(
  request: Request,
  env: AuthConfig,
  key?: JWTVerifyGetKey,
) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.OWNER_EMAIL)
    fail(503, "管理登录尚未配置，请联系维护者");
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))
    fail(503, "管理登录配置无效");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) fail(401, "请先通过维护者身份验证");
  try {
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    const { payload } = await jwtVerify(
      token,
      key ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
      {
        issuer,
        audience: env.ACCESS_AUD,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "email", "sub"],
        clockTolerance: 0,
      },
    );
    if (
      typeof payload.email !== "string" ||
      payload.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()
    )
      fail(403, "此账号没有编辑权限");
    return payload;
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    fail(401, "登录已过期或身份无效，请重新登录");
  }
}
