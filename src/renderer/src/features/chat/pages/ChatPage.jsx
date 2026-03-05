import ChatScreen from '../components/ChatScreen'

function ChatPage({ user }) {
  return (
    <section className="chat-page-layout">
      <div className="chat-page-main">
        <ChatScreen user={user} />
      </div>
    </section>
  )
}

export default ChatPage
