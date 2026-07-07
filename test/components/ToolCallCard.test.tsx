// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ToolCallCard from '../../src/renderer/src/components/chat/ToolCallCard'

describe('ToolCallCard', () => {
  it('renders tool name and success status', () => {
    render(<ToolCallCard toolName="read_file" status="success" duration={12} />)
    expect(screen.getByText('read_file')).toBeInTheDocument()
  })

  it('renders running spinner', () => {
    render(<ToolCallCard toolName="execute_command" status="running" />)
    expect(screen.getByText('execute_command')).toBeInTheDocument()
  })

  it('renders error state', () => {
    render(<ToolCallCard toolName="write_file" status="error" />)
    expect(screen.getByText('write_file')).toBeInTheDocument()
  })

  it('renders pending state', () => {
    render(<ToolCallCard toolName="search" status="pending" />)
    expect(screen.getByText('search')).toBeInTheDocument()
  })
})
