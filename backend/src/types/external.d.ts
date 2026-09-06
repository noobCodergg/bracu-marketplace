declare module 'cookie-parser' {
  import type {RequestHandler} from 'express';
  const cookieParser:()=>RequestHandler;
  export default cookieParser;
}

declare module 'jsonwebtoken' {
  export interface SignOptions{subject?:string;expiresIn?:string|number;algorithm?:'HS256';issuer?:string;audience?:string}
  export interface VerifyOptions{algorithms?:string[];issuer?:string;audience?:string}
  export function sign(payload:object,secret:string,options?:SignOptions):string;
  export function verify(token:string,secret:string,options?:VerifyOptions):unknown;
  const jwt:{sign:typeof sign;verify:typeof verify};
  export default jwt;
}
