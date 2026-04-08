import * as vscode from 'vscode';
import { config } from './config';

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Markdown Inline Editor');
  }
  return outputChannel;
}

function stringifyDetails(details: Record<string, unknown> | undefined): string {
  if (!details) {
    return '';
  }

  const parts = Object.entries(details).map(([key, value]) => `${key}=${String(value)}`);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message || error.toString();
  }
  return String(error);
}

function writeLine(level: 'debug' | 'warn' | 'error' | 'perf', message: string, details?: Record<string, unknown>): void {
  getOutputChannel().appendLine(`[${level}] ${message}${stringifyDetails(details)}`);
}

export function logDebug(message: string, details?: Record<string, unknown>): void {
  if (!config.debug.loggingEnabled()) {
    return;
  }

  writeLine('debug', message, details);
}

function logWithError(level: 'warn' | 'error', message: string, error?: unknown, details?: Record<string, unknown>): void {
  writeLine(level, message, {
    ...details,
    ...(error === undefined ? {} : { error: stringifyError(error) }),
  });
}

export function logWarn(message: string, error?: unknown, details?: Record<string, unknown>): void {
  logWithError('warn', message, error, details);
}

export function logError(message: string, error?: unknown, details?: Record<string, unknown>): void {
  logWithError('error', message, error, details);
}

export function logPerformanceMetric(metric: string, details: Record<string, unknown>): void {
  if (!config.debug.performanceEnabled()) {
    return;
  }

  writeLine('perf', metric, details);
}

export function disposeLogger(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
