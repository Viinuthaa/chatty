
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
    const code = roomCode.trim().toUpperCase()

    if (!code) {
      setError('Please enter a room code.')
      return
    }

    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      setError('Room codes must contain 4–8 letters or numbers.')
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

            <form
              onSubmit={(event) => {
                event.preventDefault()
                joinRoom()
              }}
              className="flex flex-col gap-4"
            >
              <RoomCodeInput
                value={roomCode}
                onChange={(value) => {
                  setRoomCode(value)
                  setError('')
                }}
                aria-label="Room code"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'room-code-error' : undefined}
              />

              <Button
                type="submit"
                variant="secondary"
                disabled={!roomCode.trim()}
              >
                Join Room
              </Button>

              {error && (
                <p
                  id="room-code-error"
                  role="alert"
                  className="text-sm text-red-700"
                >
                  {error}
                </p>
              )}
            </form>

            <p className="text-xs leading-5 text-plum-muted">
              Room codes can contain 4–8 letters or numbers.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
