import { useState, type KeyboardEvent } from "react"

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  t?: (key: string) => string
}

export default function TagInput({ tags, onChange, placeholder, t }: TagInputProps) {
  const [inputValue, setInputValue] = useState("")

  const addTag = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue("")
  }

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "，") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const removeTitle = t ? t("remove_tag") : "Remove tag"
  const tagPlaceholder = tags.length === 0 
    ? (placeholder || (t ? t("add_tag_chip") : "Add tag...")) 
    : (t ? t("add_tag_short") : "+ Tag")

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all min-h-[42px]">
      {tags.map((tag, idx) => (
        <span
          key={tag + idx}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs group animate-in zoom-in-95 duration-100"
        >
          <span>#{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(idx)}
            className="text-blue-400 hover:text-blue-700 hover:bg-blue-200/50 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-colors text-[10px]"
            title={removeTitle}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue)
        }}
        placeholder={tagPlaceholder}
        className="flex-1 min-w-[100px] text-xs bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 py-0.5"
      />
    </div>
  )
}

