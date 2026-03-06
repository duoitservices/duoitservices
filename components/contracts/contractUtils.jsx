/**
 * Returns true if a contract is active and its end_date has not passed.
 */
export function isContractOperational(contract) {
  if (!contract) return false;
  if (contract.status !== 'Ativo') return false;
  if (!contract.end_date) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(contract.end_date);
  endDate.setHours(0, 0, 0, 0);
  return endDate >= today;
}