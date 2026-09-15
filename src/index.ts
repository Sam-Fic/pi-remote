/**
 * Extension entry for pi-remote. pi loads `pi.extensions` files and calls the
 * default export with the ExtensionAPI — mirror of pi-task's src/index.ts, but
 * registering only the remote web view.
 */
import type {ExtensionAPI} from '@earendil-works/pi-coding-agent'
import {registerRemote} from './remote/register.js'

export default function (pi: ExtensionAPI): void {
    registerRemote(pi)
}
