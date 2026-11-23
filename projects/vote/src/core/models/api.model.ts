 
export interface APIResult<T = any> {
    result:              T;
    targetUrl:           string;
    success:             boolean;
    error:               APIError;
    unAuthorizedRequest: boolean;
    __abp:               boolean;
} 
 

export interface APIError {
    code:             number;
    message:          string;
    details:          string;
    validationErrors: null;
}
