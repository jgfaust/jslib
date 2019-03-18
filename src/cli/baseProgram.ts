import * as chk from 'chalk';

import { Response } from './models/response';
import { ListResponse } from './models/response/listResponse';
import { MessageResponse } from './models/response/messageResponse';
import { StringResponse } from './models/response/stringResponse';

import { UserService } from '../abstractions/user.service';

const chalk = chk.default;

export abstract class BaseProgram {
    constructor(private userService: UserService, private writeLn: (s: string, finalLine: boolean) => void) { }

    protected processResponse(response: Response, exitImmediately = false, dataProcessor: () => string = null) {
        if (!response.success) {
            if (process.env.BW_QUIET !== 'true') {
                if (process.env.BW_RESPONSE === 'true') {
                    this.writeLn(this.getJson(response), true);
                } else {
                    this.writeLn(chalk.redBright(response.message), true);
                }
            }
            if (exitImmediately) {
                process.exit(1);
            } else {
                process.exitCode = 1;
            }
            return;
        }

        if (process.env.BW_RESPONSE === 'true') {
            this.writeLn(this.getJson(response), true);
        } else if (response.data != null) {
            let out: string = dataProcessor != null ? dataProcessor() : null;
            if (out == null) {
                if (response.data.object === 'string') {
                    const data = (response.data as StringResponse).data;
                    if (data != null) {
                        out = data;
                    }
                } else if (response.data.object === 'list') {
                    out = this.getJson((response.data as ListResponse).data);
                } else if (response.data.object === 'message') {
                    out = this.getMessage(response);
                } else {
                    out = this.getJson(response.data);
                }
            }

            if (out != null && process.env.BW_QUIET !== 'true') {
                this.writeLn(out, true);
            }
        }
        if (exitImmediately) {
            process.exit(0);
        } else {
            process.exitCode = 0;
        }
    }

    protected getJson(obj: any): string {
        if (process.env.BW_PRETTY === 'true') {
            return JSON.stringify(obj, null, '  ');
        } else {
            return JSON.stringify(obj);
        }
    }

    protected getMessage(response: Response) {
        const message = (response.data as MessageResponse);
        if (process.env.BW_RAW === 'true' && message.raw != null) {
            return message.raw;
        }

        let out: string = '';
        if (message.title != null) {
            if (message.noColor) {
                out = message.title;
            } else {
                out = chalk.greenBright(message.title);
            }
        }
        if (message.message != null) {
            if (message.title != null) {
                out += '\n';
            }
            out += message.message;
        }
        return out.trim() === '' ? null : out;
    }

    protected async exitIfAuthed() {
        const authed = await this.userService.isAuthenticated();
        if (authed) {
            const email = await this.userService.getEmail();
            this.processResponse(Response.error('You are already logged in as ' + email + '.'), true);
        }
    }

    protected async exitIfNotAuthed() {
        const authed = await this.userService.isAuthenticated();
        if (!authed) {
            this.processResponse(Response.error('You are not logged in.'), true);
        }
    }
}