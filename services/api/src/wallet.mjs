import { ApiError } from './errors.mjs';

const BALANCE_NOT_IMPLEMENTED_MESSAGE = '钱包暂未接入共同服务；余额与提现暂不可用。';
const WITHDRAW_NOT_IMPLEMENTED_MESSAGE = '钱包暂未接入共同服务；提现暂不可用。';

export function getMerchantWallet() {
  throw new ApiError('NOT_IMPLEMENTED', BALANCE_NOT_IMPLEMENTED_MESSAGE, 501, false);
}

export function requestMerchantWithdraw() {
  throw new ApiError('NOT_IMPLEMENTED', WITHDRAW_NOT_IMPLEMENTED_MESSAGE, 501, false);
}