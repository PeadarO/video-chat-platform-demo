export class WebRTCClient{
  private id : string;
  private stream: MediaStream;

  constructor(id: string, stream: MediaStream) {
    this.id = id;
    this.stream = stream;
  }

  getid(): string {
    return this.id;
  }

  getstream(): MediaStream {
    return this.stream;
  }

  setId(val: string) {
    this.id = val;
  }

  setStream(val: MediaStream) {
    this.stream = val;
  }
}
