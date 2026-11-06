import crypto from "node:crypto";
export function generateClientId(nickname){return `${nickname}-${crypto.randomUUID().slice(0,8)}`;}
