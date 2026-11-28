export interface IResponse<T> {
  error: IResponseError;

  responseHeader: Record<string, string>;

  result: T;
  success: boolean;
  targetUrl: any;
  unAuthorizedRequest: boolean;
  __abp: boolean;
}

export interface IResponseError {
  code: number;
  details: any;
  message: string;
  validationErrors: any;
}
