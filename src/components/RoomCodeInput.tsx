
import type { InputHTMLAttributes } from 'react'

type RoomCodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> & {
  value: string
  onChange: (value: string) => void
}

function RoomCodeInput({
  value,
  onChange,
  className = '',
  ...props
}: RoomCodeInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 8),
        )
      }
      placeholder="Enter room code"
      autoComplete="off"
      spellCheck={false}
      className={`w-full rounded-xl border border-plum/20 bg-white/50 px-4 py-3 text-center uppercase tracking-widest outline-none transition focus:border-plum focus:ring-2 focus:ring-plum/10 placeholder:normal-case placeholder:tracking-normal ${className}`}
      {...props}
    />
  )
}

export default RoomCodeInput
