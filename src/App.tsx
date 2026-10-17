
import { useState } from 'react'
import Button from './components/Button'
import ChatRoom from './components/ChatRoom'
import RoomCodeInput from './components/RoomCodeInput'

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function App() {
  const [roomCode, setRoomCode] = useState('')
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [error, setError] = useState('')

  function createRoom() {
    setError('')
    setActiveRoom(generateRoomCode())
  }

  function joinRoom() {
    const code = roomCode.trim()

    if (code.length < 4) {
      setError('Enter a room code with at least 4 characters.')
      return
    }

    setError('')
    setActiveRoom(code)
  }

  if (activeRoom) {
    return (
      <ChatRoom
        roomCode={activeRoom}
        onLeave={() => {
          setActiveRoom(null)
          setRoomCode('')
          setError('')
        }}
      />
    )
  }

  return (
    <main className="min-h-screen bg-milk text-plum">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-10">
        <header className="flex justify-center pt-8">
          <h1 className="text-6xl font-bold tracking-tight sm:text-8xl">
            Chatty
          </h1>
        </header>

        <section className="flex flex-1 flex-col items-center pt-12 pb-16 text-center sm:pt-14">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Create instant chat rooms.
          </h2>

          <p className="mt-4 max-w-xl text-base leading-7 text-plum-soft sm:text-lg">
            Generate a unique code, share it with your friends,
            and start chatting. No sign-up needed.
          </p>

          <div className="mt-9 flex w-full max-w-xs flex-col gap-4">
            <Button onClick={createRoom}>Create New Room</Button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-plum/15" />
              <span className="text-sm text-plum-soft">or join one</span>
              <div className="h-px flex-1 bg-plum/15" />
            </div>

            <RoomCodeInput
              value={roomCode}
              onChange={(value) => {
                setRoomCode(value)
                setError('')
              }}
              aria-label="Room code"
              onKeyDown={(event) => {
                if (event.key === 'Enter') joinRoom()
              }}
            />

            <Button
              variant="secondary"
              disabled={roomCode.trim().length < 4}
              onClick={joinRoom}
            >
              Join Room
            </Button>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
