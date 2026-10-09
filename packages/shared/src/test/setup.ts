import React from 'react';
import '@testing-library/react';

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * jsdom implements neither of these, and both are used by components under
 * test: the dialog relies on the native modal API, and the image uploader
 * creates object URLs for previews.
 */
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
}

/**
 * jsdom has no DataTransfer, which drag-and-drop needs.
 *
 * Minimal on purpose: a list of files and the `items.add` used to fill it,
 * which is all the drop handlers read.
 */
if (typeof globalThis.DataTransfer === 'undefined') {
  class DataTransferStub {
    readonly files: File[] = [];

    readonly items = {
      add: (file: File) => {
        this.files.push(file);
      },
    };
  }

  Object.defineProperty(globalThis, 'DataTransfer', { value: DataTransferStub, writable: true });
}

/**
 * Builds a drop event carrying files.
 *
 * jsdom's DragEvent constructor ignores `dataTransfer`, so it is attached
 * afterwards — otherwise the handler sees an event with no files and the test
 * passes for the wrong reason.
 */
export function dropEvent(files: File[]): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });

  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));

  Object.defineProperty(event, 'dataTransfer', { value: transfer });

  return event;
}

/**
 * The Next hooks every feature screen reaches for.
 *
 * Mocked here rather than per file because `vi.mock` is hoisted above
 * everything else in a module — it cannot be wrapped in a helper, so the only
 * way to write it once is to write it where every test file already loads.
 *
 * These are stubs, not fakes: the screens read the query string and render
 * links, and none of the behaviour under test depends on routing actually
 * happening.
 */
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...rest }, children),
}));

/**
 * jsdom has no layout, so it implements neither of these.
 *
 * useErrorFocus calls scrollIntoView to bring a rejected field into view, and
 * the dialog measures itself. Both are no-ops without a viewport, but an
 * absent function throws.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
