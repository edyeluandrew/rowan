import OrderChat from '../../../wallet/components/chat/OrderChat';

export default function TraderOrderChat({ transactionId, txState }) {
  return (
    <OrderChat
      transactionId={transactionId}
      txState={txState}
      counterpartyName="Customer"
      viewerRole="trader"
    />
  );
}
