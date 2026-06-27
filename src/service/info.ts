/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 用户信息 POST /me/info */
export function infoUsingGet({ options }: { options?: CustomRequestOptions_ }) {
  return request<API.InfoUsingGetResponse>('/me/info', {
    method: 'POST',
    ...(options || {}),
  });
}
