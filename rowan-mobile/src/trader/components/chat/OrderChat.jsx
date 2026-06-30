import { useSocket } from '../../context/SocketContext';
import * as chatApi from '../../api/chat';
import { OrderChatCore } from '../../../wallet/components/chat/OrderChat';

/** Trader app order chat — uses trader SocketContext (not wallet). */
export default function TraderOrderChat(props) {
  const { on, off, joinOrder } = useSocket();
  return (
    <OrderChatCore
      {...props}
      on={on}
      off={off}
      joinOrder={joinOrder}
      chatApi={chatApi}
      emptyPlaceholder="Say hello to your customer to get started"
    />
  );
}
