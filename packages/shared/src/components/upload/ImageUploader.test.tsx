import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { dropEvent } from '../../test/setup';
import { ImageUploader, type ImageSelection } from './ImageUploader';

/**
 * The image control (spec §21, §31).
 *
 * Its whole job is to answer one question in three possible ways: here is a
 * new file, delete the one you have, or I did not touch it. Collapsing those
 * three into two is how an edit silently wipes a picture — so most of what is
 * checked here is which of the three it reported.
 *
 * The size and type checks are for quick feedback only. Laravel validates the
 * file again against its real content, and that is the check that counts.
 */

function imageFile(name = 'photo.jpg', type = 'image/jpeg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('ImageUploader', () => {
  // Typed, so the mock has to match the prop it stands in for — an untyped
  // vi.fn() would accept any shape and the assertions below would prove less.
  let onChange: Mock<(selection: ImageSelection) => void>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  const lastSelection = (): ImageSelection => onChange.mock.calls.at(-1)![0];

  it('says nothing until something happens', () => {
    render(<ImageUploader onChange={onChange} />);

    // Silence is "leave it alone"; an eager initial call would read as a change.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('اسحب صورة هنا أو اضغط للاختيار')).toBeTruthy();
  });

  it('reports a chosen file and shows a preview', async () => {
    const user = userEvent.setup();
    const { container } = render(<ImageUploader onChange={onChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, imageFile());

    expect(lastSelection()).toEqual({ file: expect.any(File), removed: false });

    await waitFor(() => expect(screen.getByAltText('معاينة الصورة')).toBeTruthy());
  });

  it('refuses a file that is not an allowed image', async () => {
    /*
     * Dropped rather than picked. The input carries an `accept` list, so the
     * file dialog filters this out before the component is involved — which
     * means the JavaScript check only ever matters on the drop path, and
     * testing it through the picker would assert nothing.
     */
    const { container } = render(<ImageUploader onChange={onChange} />);

    const zone = container.querySelector('.border-dashed') as HTMLElement;
    zone.dispatchEvent(dropEvent([imageFile('shell.php', 'application/x-php')]));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('JPEG'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a file over five megabytes', async () => {
    const { container } = render(<ImageUploader onChange={onChange} />);

    const zone = container.querySelector('.border-dashed') as HTMLElement;
    zone.dispatchEvent(dropEvent([imageFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024)]));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('٥ ميجابايت'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('asks for deletion only when there is a stored image to delete', async () => {
    const user = userEvent.setup();

    render(<ImageUploader currentUrl="https://example.test/stored.jpg" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /إزالة/ }));

    expect(lastSelection()).toEqual({ file: null, removed: true });
  });

  it('discarding a pick that was never saved is not a deletion', async () => {
    const user = userEvent.setup();
    const { container } = render(<ImageUploader onChange={onChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, imageFile());
    await user.click(screen.getByRole('button', { name: /إزالة/ }));

    // There is nothing on the server to remove, so `removed` must stay false —
    // otherwise the form sends remove_image for a record that has no image.
    expect(lastSelection()).toEqual({ file: null, removed: false });
  });

  it('replacing a stored image sends the file, not a deletion', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ImageUploader currentUrl="https://example.test/stored.jpg" onChange={onChange} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, imageFile('new.jpg'));

    // The backend swaps the file; asking it to delete as well would race.
    expect(lastSelection()).toEqual({ file: expect.any(File), removed: false });
  });

  it('shows the stored image until something replaces it', () => {
    render(<ImageUploader currentUrl="https://example.test/stored.jpg" onChange={onChange} />);

    const preview = screen.getByAltText('معاينة الصورة') as HTMLImageElement;

    expect(preview.src).toBe('https://example.test/stored.jpg');
  });

  it('accepts a file dropped onto it', async () => {
    const { container } = render(<ImageUploader onChange={onChange} />);

    const zone = container.querySelector('.border-dashed') as HTMLElement;
    zone.dispatchEvent(dropEvent([imageFile()]));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(lastSelection().file).toBeInstanceOf(File);
  });

  it('shows a server-side error beside the control', () => {
    // Laravel rejected the file even though the browser was happy with it.
    render(<ImageUploader onChange={onChange} error="الملف المرفوع ليس صورة صالحة للقراءة." />);

    expect(screen.getByRole('alert').textContent).toContain('ليس صورة');
  });

  it('is marked optional, because it is', () => {
    render(<ImageUploader onChange={onChange} />);

    expect(screen.getByText('(اختياري)')).toBeTruthy();
  });
});
