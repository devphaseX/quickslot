import { type Context } from "hono";
import { ContentfulStatusCode, type StatusCode } from "hono/utils/http-status";
import StatusCodes from "http-status";
import { ResponseErrorCode } from "../enums/response_codes";

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

export type ApiSuccessResponse<Data = unknown> = {
  success: true;
} & ApiBaseResponse &
  Data;

export type ApiErrorResponse = {
  success: false;
  error_code?: ResponseErrorCode;
  message: string;
  errors: Record<string, unknown> | Error;
} & ApiBaseResponse;

export function successResponse<
  Data = unknown,
  StatusCode extends ContentfulStatusCode = 200,
>(c: Context, data?: Data, code?: StatusCode, message?: string) {
  return c.json(
    <ApiSuccessResponse<Data>>{ success: true, message, ...data },
    code ?? StatusCodes.OK,
  );
}

export function errorResponse<StatusCode extends ContentfulStatusCode>(
  c: Context,
  message: string,
  options?: {
    status_code?: StatusCode;
    error_code?: ResponseErrorCode;
    errors?: any;
  },
) {
  const {
    error_code,
    errors,
    status_code = StatusCodes.INTERNAL_SERVER_ERROR,
  } = options ?? {};
  return c.json(
    <ApiErrorResponse>{ success: false, message, error_code, errors },
    status_code,
  );
}
