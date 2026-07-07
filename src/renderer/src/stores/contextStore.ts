import { create } from 'zustand'

interface ContextState {
  activeFile: string | null
  cursorLine: number
  selectedText: string
  openFiles: string[]
  setActiveFile: (file: string | null) => void
  setCursorLine: (line: number) => void
  setSelectedText: (text: string) => void
  setOpenFiles: (files: string[]) => void
}

export const useContextStore = create<ContextState>((set) => ({
  activeFile: null,
  cursorLine: 0,
  selectedText: '',
  openFiles: [],
  setActiveFile: (file) => set({ activeFile: file }),
  setCursorLine: (line) => set({ cursorLine: line }),
  setSelectedText: (text) => set({ selectedText: text }),
  setOpenFiles: (files) => set({ openFiles: files }),
}))
