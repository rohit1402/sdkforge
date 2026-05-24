import kleur from 'kleur';

interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

interface LogOptions {
    quiet?: boolean;
}

const defaultOptions: LogOptions = {
    quiet: false,
};

const makeLogger = (opts: LogOptions = defaultOptions): Logger => ({
    info(message: string) {
        if (!opts.quiet) console.log(kleur.green('✔') + ' ' + message);
    },
    warn(message: string) {
        if (!opts.quiet) console.log(kleur.yellow('⚠') + ' ' + message);
    },
    error(message: string) {
        if (!opts.quiet) console.log(kleur.red('✖') + ' ' + message);
    },
});

export default makeLogger;
