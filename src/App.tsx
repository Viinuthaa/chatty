
import { useState } from 'react'
import Button from './components/Button'
import RoomCodeInput from './components/RoomCodeInput'

function App() {
  const [roomCode, setRoomCode] = useState('')

  return (
    <main className="min-h-screen bg-milk text-plum">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-10">
        <header className="flex justify-center pt-8">
          <h1 className="text-6xl font-bold tracking-tight sm:text-8xl">
            Chatty
          </h1>
        </header>

        <section className="flex flex-col items-center pt-12 pb-16 text-center sm:pt-14">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Create instant chat rooms.
          </h2>

          <p className="mt-4 max-w-xl text-base leading-7 text-plum-soft sm:text-lg">
            Generate a unique code, share it with your friends,
            and start chatting. No sign-up needed.
          </p>

          <div className="mt-9 flex w-full max-w-xs flex-col gap-4">
            <Button disabled>Create New Room</Button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-plum/15" />
              <span className="text-sm text-plum-soft">or join one</span>
              <div className="h-px flex-1 bg-plum/15" />
            </div>

            <RoomCodeInput
              value={roomCode}
              onChange={setRoomCode}
              aria-label="Room code"
            />

            <Button variant="secondary" disabled={!roomCode}>
              Join Room
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
