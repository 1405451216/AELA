// 文件与编辑 API（fileChange, multiFile, testGen, wiki）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  FileChangeRecord,
  FileDiffLine,
  MultiFileEdit,
  MultiFileEditResult,
  TestGenAnalysis,
  TestGenResult,
  WikiDocument,
} from '@shared/types'

export const fileChangeApi = {
  list: (sessionId?: string): Promise<FileChangeRecord[]> => invoke(IPC_CHANNELS.FILE_CHANGE_LIST, sessionId),
  get: (id: string): Promise<{ change: FileChangeRecord; diff: FileDiffLine[] } | null> => invoke(IPC_CHANNELS.FILE_CHANGE_GET, id),
  clear: (sessionId?: string): Promise<boolean> => invoke(IPC_CHANNELS.FILE_CHANGE_CLEAR, sessionId),
  accept: (id: string): Promise<FileChangeRecord | undefined> => invoke(IPC_CHANNELS.FILE_CHANGE_ACCEPT, id),
  reject: (id: string): Promise<FileChangeRecord | undefined> => invoke(IPC_CHANNELS.FILE_CHANGE_REJECT, id),
}

export const multiFileApi = {
  read: (filePath: string): Promise<string> => invoke(IPC_CHANNELS.MULTIFILE_READ, filePath),
  writeBatch: (edits: MultiFileEdit[]): Promise<MultiFileEditResult[]> => invoke(IPC_CHANNELS.MULTIFILE_WRITE_BATCH, edits),
  listChanges: (sessionId?: string): Promise<FileChangeRecord[]> => invoke(IPC_CHANNELS.MULTIFILE_LIST_CHANGES, sessionId),
}

export const testGenApi = {
  analyze: (filePath: string): Promise<TestGenAnalysis> => invoke(IPC_CHANNELS.TESTGEN_ANALYZE, filePath),
  generate: (filePath: string, modelConfigId: string): Promise<TestGenResult> => invoke(IPC_CHANNELS.TESTGEN_GENERATE, filePath, modelConfigId),
  run: (testFilePath: string): Promise<{ success: boolean; output: string; passed: number; failed: number }> => invoke(IPC_CHANNELS.TESTGEN_RUN, testFilePath),
}

export const wikiApi = {
  generate: (workspaceId: string, modelConfigId: string): Promise<WikiDocument> => invoke(IPC_CHANNELS.WIKI_GENERATE, workspaceId, modelConfigId),
  get: (id: string): Promise<WikiDocument | null> => invoke(IPC_CHANNELS.WIKI_GET, id),
  list: (workspaceId?: string): Promise<WikiDocument[]> => invoke(IPC_CHANNELS.WIKI_LIST, workspaceId),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.WIKI_DELETE, id),
}
