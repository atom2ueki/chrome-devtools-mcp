/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import {readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, it} from 'node:test';

import {getMockRequest, getMockResponse, html, withBrowser} from './utils.js';

describe('McpResponse', () => {
  it('list pages', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludePages(true);
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.deepStrictEqual(
        result[0].text,
        `# test response
## Pages
0: about:blank [selected]`,
      );
    });
  });

  it('allows response text lines to be added', async () => {
    await withBrowser(async (response, context) => {
      response.appendResponseLine('Testing 1');
      response.appendResponseLine('Testing 2');
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.deepStrictEqual(
        result[0].text,
        `# test response
Testing 1
Testing 2`,
      );
    });
  });

  it('does not include anything in response if snapshot is null', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();
      page.accessibility.snapshot = async () => null;
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.deepStrictEqual(result[0].text, `# test response`);
    });
  });

  it('returns correctly formatted snapshot for a simple tree', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();
      await page.setContent(
        html`<button>Click me</button
          ><input
            type="text"
            value="Input"
          />`,
      );
      await page.focus('button');
      response.includeSnapshot();
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.strictEqual(
        result[0].text,
        `# test response
## Page content
uid=1_0 RootWebArea "My test page"
  uid=1_1 button "Click me" focusable focused
  uid=1_2 textbox value="Input"
`,
      );
    });
  });

  it('returns values for textboxes', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();
      await page.setContent(
        html`<label
          >username<input
            name="username"
            value="mcp"
        /></label>`,
      );
      await page.focus('input');
      response.includeSnapshot();
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.strictEqual(
        result[0].text,
        `# test response
## Page content
uid=1_0 RootWebArea "My test page"
  uid=1_1 StaticText "username"
  uid=1_2 textbox "username" focusable focused value="mcp"
`,
      );
    });
  });

  it('returns verbose snapshot', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();
      await page.setContent(html`<aside>test</aside>`);
      response.includeSnapshot({
        verbose: true,
      });
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.strictEqual(
        result[0].text,
        `# test response
## Page content
uid=1_0 RootWebArea "My test page"
  uid=1_1 ignored
    uid=1_2 ignored
      uid=1_3 complementary
        uid=1_4 StaticText "test"
          uid=1_5 InlineTextBox "test"
`,
      );
    });
  });

  it('saves snapshot to file', async () => {
    const filePath = join(tmpdir(), 'test-screenshot.png');
    try {
      await withBrowser(async (response, context) => {
        const page = context.getSelectedPage();
        await page.setContent(html`<aside>test</aside>`);
        response.includeSnapshot({
          verbose: true,
          filePath,
        });
        const result = await response.handle('test', context);
        assert.equal(result[0].type, 'text');
        console.log(result[0].text);
        assert.strictEqual(
          result[0].text,
          `# test response
## Page content
Saved snapshot to ${filePath}.`,
        );
      });
      const content = await readFile(filePath, 'utf-8');
      assert.strictEqual(
        content,
        `uid=1_0 RootWebArea "My test page"
  uid=1_1 ignored
    uid=1_2 ignored
      uid=1_3 complementary
        uid=1_4 StaticText "test"
          uid=1_5 InlineTextBox "test"
`,
      );
    } finally {
      await rm(filePath, {force: true});
    }
  });

  it('adds throttling setting when it is not null', async () => {
    await withBrowser(async (response, context) => {
      context.setNetworkConditions('Slow 3G');
      const result = await response.handle('test', context);
      assert.equal(result[0].type, 'text');
      assert.strictEqual(
        result[0].text,
        `# test response
## Network emulation
Emulating: Slow 3G
Default navigation timeout set to 100000 ms`,
      );
    });
  });

  it('does not include throttling setting when it is null', async () => {
    await withBrowser(async (response, context) => {
      const result = await response.handle('test', context);
      context.setNetworkConditions(null);
      assert.equal(result[0].type, 'text');
      assert.strictEqual(result[0].text, `# test response`);
    });
  });
  it('adds image when image is attached', async () => {
    await withBrowser(async (response, context) => {
      response.attachImage({data: 'imageBase64', mimeType: 'image/png'});
      const result = await response.handle('test', context);
      assert.strictEqual(result[0].text, `# test response`);
      assert.equal(result[1].type, 'image');
      assert.strictEqual(result[1].data, 'imageBase64');
      assert.strictEqual(result[1].mimeType, 'image/png');
    });
  });

  it('adds cpu throttling setting when it is over 1', async () => {
    await withBrowser(async (response, context) => {
      context.setCpuThrottlingRate(4);
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## CPU emulation
Emulating: 4x slowdown`,
      );
    });
  });

  it('does not include cpu throttling setting when it is 1', async () => {
    await withBrowser(async (response, context) => {
      context.setCpuThrottlingRate(1);
      const result = await response.handle('test', context);
      assert.strictEqual(result[0].text, `# test response`);
    });
  });

  it('adds a prompt dialog', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();
      const dialogPromise = new Promise<void>(resolve => {
        page.on('dialog', () => {
          resolve();
        });
      });
      page.evaluate(() => {
        prompt('message', 'default');
      });
      await dialogPromise;
      const result = await response.handle('test', context);
      await context.getDialog()?.dismiss();
      assert.strictEqual(
        result[0].text,
        `# test response
# Open dialog
prompt: message (default value: "default").
Call handle_dialog to handle it before continuing.`,
      );
    });
  });

  it('adds an alert dialog', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();
      const dialogPromise = new Promise<void>(resolve => {
        page.on('dialog', () => {
          resolve();
        });
      });
      page.evaluate(() => {
        alert('message');
      });
      await dialogPromise;
      const result = await response.handle('test', context);
      await context.getDialog()?.dismiss();
      assert.strictEqual(
        result[0].text,
        `# test response
# Open dialog
alert: message.
Call handle_dialog to handle it before continuing.`,
      );
    });
  });

  it('add network requests when setting is true', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true);
      context.getNetworkRequests = () => {
        return [getMockRequest({stableId: 1}), getMockRequest({stableId: 2})];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Network requests
Showing 1-2 of 2 (Page 1 of 1).
reqid=1 GET http://example.com [pending]
reqid=2 GET http://example.com [pending]`,
      );
    });
  });

  it('does not include network requests when setting is false', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(false);
      context.getNetworkRequests = () => {
        return [getMockRequest()];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(result[0].text, `# test response`);
    });
  });

  it('add network request when attached with POST data', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true);
      const httpResponse = getMockResponse();
      httpResponse.buffer = () => {
        return Promise.resolve(Buffer.from(JSON.stringify({response: 'body'})));
      };
      httpResponse.headers = () => {
        return {
          'Content-Type': 'application/json',
        };
      };
      const request = getMockRequest({
        method: 'POST',
        hasPostData: true,
        postData: JSON.stringify({request: 'body'}),
        response: httpResponse,
      });
      context.getNetworkRequests = () => {
        return [request];
      };
      context.getNetworkRequestById = () => {
        return request;
      };
      response.attachNetworkRequest(1);

      const result = await response.handle('test', context);

      assert.strictEqual(
        result[0].text,
        `# test response
## Request http://example.com
Status:  [success - 200]
### Request Headers
- content-size:10
### Request Body
${JSON.stringify({request: 'body'})}
### Response Headers
- Content-Type:application/json
### Response Body
${JSON.stringify({response: 'body'})}
## Network requests
Showing 1-1 of 1 (Page 1 of 1).
reqid=1 POST http://example.com [success - 200]`,
      );
    });
  });

  it('add network request when attached', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true);
      const request = getMockRequest();
      context.getNetworkRequests = () => {
        return [request];
      };
      context.getNetworkRequestById = () => {
        return request;
      };
      response.attachNetworkRequest(1);
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Request http://example.com
Status:  [pending]
### Request Headers
- content-size:10
## Network requests
Showing 1-1 of 1 (Page 1 of 1).
reqid=1 GET http://example.com [pending]`,
      );
    });
  });

  it('adds console messages when the setting is true', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeConsoleData(true);
      const page = context.getSelectedPage();
      const consoleMessagePromise = new Promise<void>(resolve => {
        page.on('console', () => {
          resolve();
        });
      });
      page.evaluate(() => {
        console.log('Hello from the test');
      });
      await consoleMessagePromise;
      const result = await response.handle('test', context);
      assert.ok(result[0].text);
      // Cannot check the full text because it contains local file path
      assert.ok(
        result[0].text.toString().startsWith(`# test response
## Console messages`),
      );
      assert.ok(result[0].text.toString().includes('Hello from the test'));
    });
  });

  it('adds a message when no console messages exist', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeConsoleData(true);
      const result = await response.handle('test', context);
      assert.ok(result[0].text);
      assert.strictEqual(
        result[0].text.toString(),
        `# test response
## Console messages
<no console messages found>`,
      );
    });
  });
});

describe('McpResponse network request filtering', () => {
  it('filters network requests by resource type', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true, {
        resourceTypes: ['script', 'stylesheet'],
      });
      context.getNetworkRequests = () => {
        return [
          getMockRequest({resourceType: 'script'}),
          getMockRequest({resourceType: 'image'}),
          getMockRequest({resourceType: 'stylesheet'}),
          getMockRequest({resourceType: 'document'}),
        ];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Network requests
Showing 1-2 of 2 (Page 1 of 1).
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]`,
      );
    });
  });

  it('filters network requests by single resource type', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true, {
        resourceTypes: ['image'],
      });
      context.getNetworkRequests = () => {
        return [
          getMockRequest({resourceType: 'script'}),
          getMockRequest({resourceType: 'image'}),
          getMockRequest({resourceType: 'stylesheet'}),
        ];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Network requests
Showing 1-1 of 1 (Page 1 of 1).
reqid=1 GET http://example.com [pending]`,
      );
    });
  });

  it('shows no requests when filter matches nothing', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true, {
        resourceTypes: ['font'],
      });
      context.getNetworkRequests = () => {
        return [
          getMockRequest({resourceType: 'script'}),
          getMockRequest({resourceType: 'image'}),
          getMockRequest({resourceType: 'stylesheet'}),
        ];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Network requests
No requests found.`,
      );
    });
  });

  it('shows all requests when no filters are provided', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true);
      context.getNetworkRequests = () => {
        return [
          getMockRequest({resourceType: 'script'}),
          getMockRequest({resourceType: 'image'}),
          getMockRequest({resourceType: 'stylesheet'}),
          getMockRequest({resourceType: 'document'}),
          getMockRequest({resourceType: 'font'}),
        ];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Network requests
Showing 1-5 of 5 (Page 1 of 1).
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]`,
      );
    });
  });

  it('shows all requests when empty resourceTypes array is provided', async () => {
    await withBrowser(async (response, context) => {
      response.setIncludeNetworkRequests(true, {
        resourceTypes: [],
      });
      context.getNetworkRequests = () => {
        return [
          getMockRequest({resourceType: 'script'}),
          getMockRequest({resourceType: 'image'}),
          getMockRequest({resourceType: 'stylesheet'}),
          getMockRequest({resourceType: 'document'}),
          getMockRequest({resourceType: 'font'}),
        ];
      };
      const result = await response.handle('test', context);
      assert.strictEqual(
        result[0].text,
        `# test response
## Network requests
Showing 1-5 of 5 (Page 1 of 1).
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]
reqid=1 GET http://example.com [pending]`,
      );
    });
  });
});

describe('McpResponse network pagination', () => {
  it('returns all requests when pagination is not provided', async () => {
    await withBrowser(async (response, context) => {
      const requests = Array.from({length: 5}, () => getMockRequest());
      context.getNetworkRequests = () => requests;
      response.setIncludeNetworkRequests(true);
      const result = await response.handle('test', context);
      const text = (result[0].text as string).toString();
      assert.ok(text.includes('Showing 1-5 of 5 (Page 1 of 1).'));
      assert.ok(!text.includes('Next page:'));
      assert.ok(!text.includes('Previous page:'));
    });
  });

  it('returns first page by default', async () => {
    await withBrowser(async (response, context) => {
      const requests = Array.from({length: 30}, (_, idx) =>
        getMockRequest({method: `GET-${idx}`}),
      );
      context.getNetworkRequests = () => {
        return requests;
      };
      response.setIncludeNetworkRequests(true, {pageSize: 10});
      const result = await response.handle('test', context);
      const text = (result[0].text as string).toString();
      assert.ok(text.includes('Showing 1-10 of 30 (Page 1 of 3).'));
      assert.ok(text.includes('Next page: 1'));
      assert.ok(!text.includes('Previous page:'));
    });
  });

  it('returns subsequent page when pageIdx provided', async () => {
    await withBrowser(async (response, context) => {
      const requests = Array.from({length: 25}, (_, idx) =>
        getMockRequest({method: `GET-${idx}`}),
      );
      context.getNetworkRequests = () => requests;
      response.setIncludeNetworkRequests(true, {
        pageSize: 10,
        pageIdx: 1,
      });
      const result = await response.handle('test', context);
      const text = (result[0].text as string).toString();
      assert.ok(text.includes('Showing 11-20 of 25 (Page 2 of 3).'));
      assert.ok(text.includes('Next page: 2'));
      assert.ok(text.includes('Previous page: 0'));
    });
  });

  it('handles invalid page number by showing first page', async () => {
    await withBrowser(async (response, context) => {
      const requests = Array.from({length: 5}, () => getMockRequest());
      context.getNetworkRequests = () => requests;
      response.setIncludeNetworkRequests(true, {
        pageSize: 2,
        pageIdx: 10, // Invalid page number
      });
      const result = await response.handle('test', context);
      const text = (result[0].text as string).toString();
      assert.ok(
        text.includes('Invalid page number provided. Showing first page.'),
      );
      assert.ok(text.includes('Showing 1-2 of 5 (Page 1 of 3).'));
    });
  });
});
