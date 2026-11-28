import * as tus from 'tus-js-client';

export class ReplaceContentTypeHttpStack implements tus.HttpStack {
  private base: tus.HttpStack;

  constructor(base: tus.HttpStack = new tus.DefaultHttpStack({})) {
    this.base = base;
  }

  createRequest(method: string, url: string) {
    const req = this.base.createRequest(method, url);
    const origSetHeader = req.setHeader.bind(req);

    req.setHeader = (name: string, value: string) => {
      if (name.toLowerCase() === 'content-type' && value === 'application/offset+octet-stream') {
        return origSetHeader('Content-Type', 'application/octet-stream');
      }
      return origSetHeader(name, value);
    };

    return req;
  }

  getName(): string {
    return 'ReplaceContentTypeHttpStack';
  }
}
