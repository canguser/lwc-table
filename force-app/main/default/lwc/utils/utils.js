/**
 * Created by ryan on 2019-07-25.
 */
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { LightningElement } from 'lwc';

const DOMEventMapper = {};

export const NONE_PROMISE_RESPONSE = Symbol('NONE_PROMISE_RESPONSE');

function hasEnumerableProperty(target, p) {
    const descriptor = Object.getOwnPropertyDescriptor(target, p);
    return descriptor && descriptor.enumerable;
}

function delay(context, apiName, ms = 0) {
    const eqName = `_delay_${apiName}`;
    clearTimeout(context[eqName]);
    return new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        context[eqName] = setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

function eachInArrays(parentArray = [], array = []) {
    for (const a of array) {
        if (parentArray.includes(a)) {
            return true;
        }
    }
    return false;
}

function isBasicDateType(o) {
    return typeof o !== 'object' || !o || o instanceof Date;
}

class ConfigInstance {

    constructor(
        {
            root,
            config,
            parent,
            provider,
            property,
            asyncAssign
        }
    ) {
        // init provider
        this.localProvider = {
            root, parent, instance: this, property
        };

        // init basic data
        this.cache = {};
        this.origin = config;
        this.provider = provider;
        this.infectedCallbacks = [];
        this.asyncAssign = asyncAssign;
    }

    updateLocalProvider(provider = {}) {
        Object.assign(this.localProvider, provider);
    }

    getLocalProvider() {
        const provider = {};
        for (const key of Object.keys(this.localProvider)) {
            provider['$' + key] = this.localProvider[key];
        }
        return provider;
    }

    getCache() {
        return this.cache || {};
    }

    applyCache(cache) {
        this.cache = cache;
    }

    emptyCache(keys) {
        if (!keys || !keys.length) {
            this.applyCache({});
        } else {
            for (const key of keys) {
                const cacheKey = '_' + key;
                this.cache[cacheKey] = undefined;
                delete this.cache[cacheKey];
            }
        }
    }

    get parentInstance() {
        const { parent } = this.localProvider;
        return parent && parent.$instance;
    }

    get propertyFromParent() {
        return this.localProvider.property;
    }

    get rootInstance() {
        const { root } = this.localProvider;
        if (root) {
            return root.instance;
        }
        return null;
    }

    applyProxy(proxy) {
        this.proxy = proxy;
    }

    registerInfectedCallback(keys = [], callback, options = {}) {
        const { isOnce = false } = options;
        if (typeof callback === 'function') {
            this.infectedCallbacks.push({
                keys,
                callback,
                isOnce,
                executed: false
            });
            if (!this.isRoot) {
                const providerKeys = keys.filter(key => Object.keys(this.provider).includes(key));
                if (providerKeys.length > 0) {
                    this.rootInstance.registerInfectedCallback(keys, callback, options);
                }
            }
        }
    }

    get isRoot() {
        const { rootInstance } = this;
        return rootInstance === this || rootInstance == null;
    }

    getInfectedCallbacksByKeys(infectedKeys = []) {
        if (!infectedKeys || infectedKeys.length === 0) {
            return [];
        }
        const providerKeys = Object.keys(this.provider);
        const isInfectedProviderKey = eachInArrays(infectedKeys, providerKeys);
        return this.infectedCallbacks.filter(
            ({ keys = [] }) => {
                if (!this.isRoot && eachInArrays(keys, providerKeys) && isInfectedProviderKey) {
                    // prevent callback called twice
                    return false;
                }
                for (const key of keys) {
                    if (infectedKeys.includes(key)) {
                        return true;
                    }
                }
                return keys.length === 0;
            }
        );
    }

    removeOnceInfectedCallbacks() {
        this.infectedCallbacks = this.infectedCallbacks.filter(
            cb => !(cb.isOnce && cb.executed)
        );
    }

    executeInfected(executeFunc) {
        if (!this.proxy) {
            console.warn('Instance\'s proxy not bind yet.');
            return;
        }
        this.isRecordingInfected = true;
        executeFunc.call(this.proxy, this.proxy);
        this.isRecordingInfected = false;
        const infectedKeys = this.infectedKeys || [];
        this.infectedKeys = [];
        this.registerInfectedCallback(infectedKeys, executeFunc);
    }

    assignKeyValue(key, value) {
        this._tempAssignConfig =
            Object.assign(this._tempAssignConfig || {}, { [key]: value });
        if (this.asyncAssign) {
            delay(this, 'applyConfig')
                .then(() => {
                    this.applyConfigChanged(this._tempAssignConfig || {});
                    this._tempAssignConfig = {};
                });
        } else {
            this.applyConfigChanged(this._tempAssignConfig || {});
            this._tempAssignConfig = {};
        }
    }

    applyConfigChanged(config = {}) {
        const changedKeys = Object.keys(config);
        if (changedKeys.length === 0) {
            return;
        }

        const infectedKeys = [];
        const infectedProviderKeys = [];

        for (const key of changedKeys) {
            if (hasEnumerableProperty(this.provider, key)) {
                if (config[key] !== this.provider[key]) {
                    this.provider[key] = config[key];
                    infectedKeys.push(key);
                    infectedProviderKeys.push(key);
                }
                continue;
            }
            if (config[key] !== this.origin[key]) {
                this.origin[key] = config[key];
                infectedKeys.push(key);
            }
        }

        if (!this.isRoot) {
            this.rootInstance.triggerInfectedCallbacks(infectedProviderKeys);
        }

        this.triggerInfectedCallbacks(infectedKeys);
    }

    triggerParentInfectedCallbacks() {
        const parentInstance = this.parentInstance;
        if (parentInstance) {
            parentInstance.triggerInfectedCallbacks([this.propertyFromParent]);
        }
    }

    triggerInfectedCallbacks(infectedKeys) {
        if (infectedKeys.length > 0) {
            this.emptyCache(infectedKeys);
            for (const cb of this.getInfectedCallbacksByKeys(infectedKeys)) {
                cb.callback.call(this.proxy, this.proxy);
                cb.executed = true;
            }
            this.removeOnceInfectedCallbacks();
            this.triggerParentInfectedCallbacks();
        }
    }

}

/**
 *
 * @param config
 * @param provider
 * @param root
 * @param parent
 * @param property
 * @param cacheable
 * @param asyncAssign
 * @return {*}
 */
function _parseConfig(
    config, provider = {},
    {
        root,
        parent,
        property,
        cacheable = true,
        asyncAssign = true
    } = {}
) {
    if (isBasicDateType(config)) {
        return config;
    }

    return new Proxy(
        new ConfigInstance({ config, root, parent, property, provider, asyncAssign }),
        {
            get: (target, p, receiver) => {
                const originTarget = target.origin;
                const cache = target.getCache();
                const cacheProperty = typeof p === 'string' ? ('_' + p) : p;
                const isRoot = !root;

                // bind to instance
                target.applyProxy(receiver);

                // get the default value
                let expectValue = originTarget[p];

                // update the local provider
                const currentRoot = root || receiver;
                target.updateLocalProvider({ root: currentRoot });
                const localProvider = target.getLocalProvider();

                // check if in local provider
                if (hasEnumerableProperty(localProvider, p) && localProvider[p]) {
                    return localProvider[p];
                }

                // check if already in the cache
                if (hasEnumerableProperty(cache, cacheProperty) && cacheable) {
                    return cache[cacheProperty];
                }

                // check if in the custom provider
                if (hasEnumerableProperty(provider, p)) {
                    if (!isRoot) {
                        return currentRoot[p];
                    }
                    expectValue = provider[p];
                } else if (!hasEnumerableProperty(originTarget, p)) {
                    // if not in the provider & may be un-enumerable value
                    // sometimes appeared Array or others
                    return expectValue;
                }

                // convert all value into function
                let expectFunc = expectValue;
                if (typeof expectFunc !== 'function') {
                    expectFunc = () => expectValue;
                }

                // build the proxy to recording infected keys of expectFunc
                const infectedKeys = [];
                const expectProxyParams = new Proxy(receiver, {
                    get(target, p, receiver) {
                        infectedKeys.push(p);
                        return Reflect.get(target, p, receiver);
                    }
                });

                // build the function with specific params
                const expectResultFunc = () => _parseConfig(
                    expectFunc.call(expectProxyParams, expectProxyParams),
                    provider, {
                        root: currentRoot, parent: receiver, cacheable, asyncAssign, property: p
                    }
                );

                // get the real return value
                const returnValue = expectResultFunc();

                // if infected properties changed, reset the cache of this property
                target.registerInfectedCallback(infectedKeys, () => {
                    target.emptyCache([p]);
                }, { isOnce: true });

                const parentInstanceNames = ['$root', '$parent'];
                for (const name of parentInstanceNames) {
                    if (infectedKeys.includes(name) && receiver[name]) {
                        const instance = receiver[name].$instance;
                        if (instance) {
                            instance.registerInfectedCallback([], () => {
                                target.emptyCache([p]);
                            }, { isOnce: true });
                        }
                    }
                }

                // recording infected key
                if (target.isRecordingInfected) {
                    target.infectedKeys = target.infectedKeys || [];
                    target.infectedKeys.push(p);
                }

                // if open cache, put the value into cache
                if (cacheable) {
                    cache[cacheProperty] = returnValue;
                    target.applyCache(cache);
                }

                return returnValue;
            },
            set(target, p, value) {
                target.assignKeyValue(p, value);
                return true;
            },
            getOwnPropertyDescriptor(target, p) {
                return Reflect.getOwnPropertyDescriptor(config, p);
            },
            has(target, p) {
                return Reflect.has(config, p);
            },
            ownKeys() {
                return Reflect.ownKeys(config);
            }
        });
}

function configure(config, provider, options = {}) {
    return _parseConfig(config, provider, options);
}

function replaceAll(str, search, replacement) {
    if (typeof replacement === 'function') {
        const indexList = [];
        // search for all indexes from str by searching words
        let lastIndex = 0;
        while (true) {
            const index = str.indexOf(search, lastIndex);
            if (index === -1) {
                break;
            }
            indexList.push(index);
            lastIndex = index + search.length;
        }
        return indexList
            .reduce(({ strList, extraSize }, strIndex, index) => {
                const replacementStr = replacement(search, strIndex, str);
                strList.splice(strIndex + extraSize, search.length, replacementStr);
                return { strList, extraSize: extraSize + replacementStr.length - search.length };
            }, {
                strList: [...str],
                extraSize: 0
            })
            .strList
            .join('');
    }
    return str.split(search).join(replacement);
}

const SPECIFIED_PREFIX_CODE = '\x00';
const SPECIFIED_SUFFIX_CODE = '\x01';
function _replaceUnescapeString(source, target, to) {
    return replaceAll(source, target, (a, index, str) => {
        if (str[index - 1] !== '\\') {
            return to;
        }
        return a;
    });
}
function getBindingExpressions(_self, prefix = '{', suffix = '}') {
    _self = _replaceUnescapeString(_self, SPECIFIED_PREFIX_CODE, '');
    _self = _replaceUnescapeString(_self, SPECIFIED_SUFFIX_CODE, '');
    _self = _replaceUnescapeString(_self, prefix, SPECIFIED_PREFIX_CODE);
    _self = _replaceUnescapeString(_self, suffix, SPECIFIED_SUFFIX_CODE);
    const regex = new RegExp(`${SPECIFIED_PREFIX_CODE}.*?${SPECIFIED_SUFFIX_CODE}`);
    const regexGlobal = new RegExp(`${SPECIFIED_PREFIX_CODE}(.*?)${SPECIFIED_SUFFIX_CODE}`, 'g');
    const matchResults = [..._self.matchAll(regexGlobal)];
    return {
        raws: _self
            .split(regex)
            .map((p) => replaceAll(replaceAll(p, SPECIFIED_PREFIX_CODE, prefix), SPECIFIED_SUFFIX_CODE, suffix)),
        expressions: matchResults.map(([, expression]) => expression)
    };
}

const _join = Array.prototype.join;
function joinWith(_self, separator) {
    if (typeof separator === 'function') {
        let resultStr = '';
        _self.forEach((item, index) => {
            if (index < _self.length - 1) {
                const part = item + '';
                resultStr += part;
                resultStr += separator(index, _self);
            }
            else {
                resultStr += item;
            }
        });
        return resultStr;
    }
    return _join.call(_self, separator);
}

const defaultOptions = {
    prefix: '{',
    suffix: '}',
    withFunction: false
};
function _execExpression(expression, context) {
    if (!expression || !expression.trim()) {
        return undefined;
    }
    try {
        // eslint-disable-next-line no-new-func
        return new Function('context', `with(context){return (${expression})}`)(new Proxy(context, {
            has() {
                return true;
            }
        }));
    }
    catch (e) {
        console.warn("there's some un-except expression: " + expression, e);
        return undefined;
    }
}

export default class Utils {

    /**
     * format the num as currency.
     * @param num {number}
     * @param symbol {string=$} - default: $
     * @param places {number=2} - the decimal digits default: 2
     * @param suffix {string=}
     * @returns {string}
     */
    static convertCurrency(num, symbol = '$', places = 2, suffix = '') {
        let number = parseFloat(num);
        if (Number.isNaN(number)) {
            return '';
        }
        if (places < 0) {
            let p = Math.abs(places);
            number /= 10 ** p;
            places = 0;
            if (number <= 1000) {
                places = 1;
            }
        }
        let thousand = ',';
        let decimal = '.';
        let negative = number < 0 ? '-' : '';
        let i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + '';
        let j = i.length;
        j = i.length > 3 ? j % 3 : 0;
        return negative + symbol + (j ? i.substr(0, j) + thousand : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : '') + suffix;
    }

    static realNumber(num){
        if (!num){
            num = 0;
        }
        if (Number.isNaN(num)){
            return 0;
        }
        return num;
    }

    static autoFormatCurrency(num, symbol = '$', picklist = [
        {
            places: 1,
            suffix: ''
        },
        {
            places: 0,
            suffix: ''
        },
        {
            places: -3,
            suffix: 'K'
        },
        {
            places: -6,
            suffix: 'M'
        }
    ]) {
        const intNumStr = parseInt(num, 10) + '';
        const option = [...picklist].sort((a, b) => intNumStr.length + a.places - 1 < 0 ? 1 : a.places - b.places)[0] || {};
        return this.convertCurrency(num, symbol, option.places, option.suffix);
    }

    static getPercent(numerator, denominator, percentFixed = false) {
        return this.convertPercent(numerator / parseFloat(denominator), percentFixed);
    }

    static convertPercent(num, percentFixed = false) {
        num = parseFloat(num);
        if (Number.isNaN(num)) {
            num = 0;
        }
        if (percentFixed) {
            num /= 100.0;
        }
        if (!Number.isFinite(num)) {
            num = 1;
        }
        return (num * 100).toFixed(0) + '%';
    }

    /**
     * get proxy from a object, any properties is treated as numbers
     * tip: if the property can not parse to number or the result is NaN, the result is default 0.
     * @param obj
     * @param defaultValue {*=0}
     * @returns {{}}
     */
    static getProxyParsingNumber(obj, defaultValue = 0) {
        if (!(obj instanceof Object || typeof obj === 'object') || !obj) {
            obj = {};
        }
        return new Proxy({ ...obj }, {
            get(target, key) {
                if (Number.isNaN(parseFloat(obj[key]))) {
                    return defaultValue;
                }
                return parseFloat(parseFloat(obj[key]).toFixed(2));
            }
        });
    }

    /**
     * get the message at the object.
     * @param _self
     * @param deep {number=10} - default 10 - how deep to retrieve at the object.
     * @returns []
     */
    static getMessage(_self, deep) {
        deep == null && (deep = 10);
        if (deep <= 0) {
            return [];
        }
        if (!_self || typeof _self === 'string') {
            return [_self];
        }
        deep = deep - 1;
        return this.flat(Object.keys(_self).map(key => {
            return this.getMessage(_self[key], deep);
        }), deep).filter(r => r != null && r !== '');
    }

    /**
     *
     * @param array {Array}
     * @param deep {number}
     * @returns {Array}
     */
    static flat(array, deep = Infinity) {

        const flat = Array.prototype.flat || function(deep = Infinity) {
            if (deep < 1) {
                return this;
            }
            let result = [];
            const nextDeep = deep - 1;
            this.forEach(a => {
                if (a instanceof Array) {
                    result = result.concat(flat.call(a, nextDeep));
                } else {
                    result.push(a);
                }
            });
            return result;
        };

        return flat.call(array, deep);

    }

    /**
     * Parse the property name to name array.
     *  eg:
     *      'a.b.c.d.e.t' => [a,b,c,d,e,t]
     * @param keyChain
     * @returns {*}
     */
    static parseKeyChain(keyChain) {
        if (typeof keyChain === 'string') {
            keyChain = keyChain.split('.');
        }
        return keyChain.filter(k => typeof k === 'string').map(k => k.replace(/ /g, ''));
    }

    /**
     * Get the object property, it's support to using link property name like: a.b.c.d.e.f
     * @param _self
     * @param propertyName
     * @returns {*}
     */
    static getProperty(_self, propertyName) {
        if (_self == null) {
            return undefined;
        }
        propertyName = this.parseKeyChain(propertyName);
        if (propertyName.length === 1) {
            return _self[propertyName[0]];
        } else if (propertyName.length > 1) {
            return this.getProperty(_self[propertyName[0]], propertyName.splice(1));
        }
        return undefined;
    }

    static genID = (length = 7) => {
        return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36);
    };

    static success(context, ...args) {
        this.showToast(context, args, { type: 'success' });
    }

    static error(context, ...args) {
        console.log(args);
        if (args[0] === NONE_PROMISE_RESPONSE) {
            return;
        }
        args = args.map(arg => {
            const errorTypeMessage = this.getProperty(arg, 'body.message');
            if (errorTypeMessage) {
                return errorTypeMessage;
            }
            return arg;
        });
        this.showToast(context, args, { type: 'error' });
    }

    static showToast(context, obj, { type = 'info', mode = 'dismissable', title = '' }) {
        const evt = new ShowToastEvent({
            title: title,
            message: this.getMessage(obj).join('; '),
            variant: type, mode
        });
        context.dispatchEvent(evt);
    }

    static daysBetween(fromDate, toDate, isAbs = true) {
        fromDate = Date.parse(fromDate);
        toDate = Date.parse(toDate);

        const days1 = Math.floor(fromDate / (24 * 3600 * 1000));
        const days2 = Math.floor(toDate / (24 * 3600 * 1000));

        return isAbs ? Math.abs(days2 - days1) : days2 - days1;
    }

    static getRelatedDaysFormat(date, dayMap = {
        '0': 'Today',
        '1': 'Tomorrow',
        '-1': 'Yesterday'
    }) {
        const today = new Date();
        const days = this.daysBetween(today, date, false);
        if (days in dayMap) {
            return dayMap[days];
        }
        if (days > 0) {
            return `${days} days later`;
        }
        return `${Math.abs(days)} days ago`;
    }

    static formatDate(date, fmt) {
        let o = {
            'M+': date.getMonth() + 1,
            'd+': date.getDate(),
            'H+': date.getHours(),
            'h+': date.getHours() % 12 || 12,
            'm+': date.getMinutes(),
            's+': date.getSeconds(),
            'q+': Math.floor((date.getMonth() + 3) / 3),
            'S': date.getMilliseconds(),
            'R': this.getRelatedDaysFormat(date),
            'TT': date.getHours() < 12 ? 'AM' : 'PM',
            'tt': date.getHours() < 12 ? 'am' : 'pm'
        };
        if (/(y+)/.test(fmt))
            fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
        for (let k in o)
            if (new RegExp('(' + k + ')').test(fmt))
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        return fmt;
    }

    static addDays(date, days = 0) {
        return new Date(date.getTime() + 1000 * 3600 * 24 * days);
    }

    static isDuringDateRange(targetDate, [startDate, endDate]) {
        targetDate = Date.parse(targetDate);
        startDate = Date.parse(startDate);
        endDate = Date.parse(endDate);
        return targetDate >= startDate && targetDate <= endDate;
    }

    /**
     * Create the proxy object for target object
     * The proxy object will return the proxy for its children using the same set method.
     * @param target
     * @param set {function} - the method to hook all set method for the proxy.
     * @param keepNull {boolean=} - if false, proxy object will just return the empty object instance
     * @param parentNames {Array=} - using to know the parent name for its children.
     * @returns {*}
     */
    static getProxyChain(target, set, keepNull = true, parentNames = []) {
        if (target == null && !keepNull) {
            target = {};
        }
        if (this.isBasicDataType(target)) {
            return target;
        }
        return new Proxy(target, {
            get: (t, name) => {
                if (typeof name === 'string' && name.startsWith('$')) {
                    const result = target[name.replace('$', '')];
                    return result instanceof Object && typeof result !== 'function' ? JSON.parse(JSON.stringify(result)) : result;
                }
                return this.getProxyChain(t[name], set, keepNull, [...parentNames, name]);
            },
            set: (t, name, value, receiver) => {
                set && (set instanceof Function) && set.call(t, {
                    origin: [t, name, value, receiver],
                    info: { parentNames }
                });
                return true;
            }
        });
    }

    /**
     * Set the object property, it's support to using link property name like: a.b.c.d.e.f
     * @param _self
     * @param propertyName {string|Array}
     * @param value
     * @returns {*}
     */
    static setProperty(_self, propertyName, value) {
        propertyName = this.parseKeyChain(propertyName);
        if (propertyName.length === 0) {
            return true;
        }
        if (_self == null) {
            return false;
        }
        if (propertyName.length === 1) {
            _self[propertyName[0]] = value;
            return true;
        } else if (propertyName.length > 1) {
            let thisKey = propertyName.splice(0, 1);
            let canSet = this.setProperty(_self[thisKey[0]], propertyName, value);
            if (!canSet) {
                _self[thisKey[0]] = {};
                return this.setProperty(_self[thisKey[0]], propertyName, value);
            }
        }
        return true;
    }

    /**
     * change date format type from [yyyy-MM-dd] to [MM/dd/yyyy]
     * @param yyyymmdd {string}
     * @returns {*}
     */
    static changeDateFormatType(yyyymmdd) {
        const dateParts = yyyymmdd.split(/[-\s]/g);
        if (dateParts.length < 3) {
            return yyyymmdd;
        }
        let result = [dateParts[1], dateParts[2], dateParts[0]].join('/');
        dateParts.splice(0, 3);
        return [result, dateParts.join(' ')].join(' ');
    }

    /**
     * Wait executing some async function.
     * @param beforeWait {function=} - the first function called, its return value will be the params for function [after].
     * @param after {function=} - the finally called function, its return value will be retrieve as the return value for wait function.
     * @param time {number=0} - the time between [beforeWait] and [after]. unit(ms).
     * @returns {Promise<any>} - from [after] return value.
     */
    static async wait(beforeWait = () => undefined, after = () => undefined, time = 0) {
        if (!(beforeWait instanceof Function && after instanceof Function)) {
            return undefined;
        }
        const result = await beforeWait();
        return new Promise(resolve => {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                (async () => {
                    // eslint-disable-next-line no-return-await
                    return await after(result);
                })().then(afterRes => {
                    resolve(afterRes);
                });
            }, time);
        });
    }

    static equalsIgnoreCase(text1, text2) {
        text1 += '';
        text2 += '';
        return text1.toLowerCase() === text2.toLowerCase();
    }

    static waitTodo(ms, params) {
        return new Promise(resolve => {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                resolve(params);
            }, ms);
        });
    }

    static waitFrame(params) {
        return new Promise(resolve => {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            window.requestAnimationFrame(() => {
                resolve(params);
            });
        });
    }

    /**
     * Limit the function called intervals times
     * @param context
     * @param apiName
     * @param ms
     */
    static limit(context, apiName, ms) {
        const canExecName = `_limit_${apiName}_no_exec`;
        const noExec = context[canExecName];
        if (!noExec) {
            context[canExecName] = true;
            Utils.waitTodo(ms)
                .then(() => {
                    context[canExecName] = false;
                });
            return Promise.resolve();
        }
        return Utils.neverPromise();
    }

    static neverPromise() {
        return new Promise(() => undefined);
    }

    static delay(context, apiName, ms) {
        const eqName = `_delay_${apiName}`;
        clearTimeout(context[eqName]);
        return new Promise(resolve => {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            context[eqName] = setTimeout(() => {
                resolve(true);
            }, ms);
        });
    }

    static capitalizes(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static fullMaxArrayItem(arr = [], size, defaultItem = undefined) {
        if (arr.length >= size) {
            return;
        }
        for (let i = arr.length; i < size; i++) {
            arr.push(defaultItem);
        }
    }

    static ProcessManager = {
        Entity: class {

            processingNum = 0;

            constructor(context, { begin = () => undefined, end = () => undefined } = {}) {
                this.context = context;
                this.begin = begin.bind(context);
                this.end = end.bind(context);
            }

            async execProcess(process = Promise.resolve()) {
                this._doBegin();
                return new Promise((resolve, reject) => {
                    Promise.resolve(process).then(res => {
                        this._doEnd();
                        resolve(res);
                    }).catch(e => {
                        this._doEnd();
                        if (e !== NONE_PROMISE_RESPONSE) {
                            reject(e);
                        }
                    });
                });
            }

            async execProcesses(processes = []) {
                return Promise.all(processes.map(process => this.execProcess(process)));
            }

            _doBegin() {
                if (this.processingNum === 0) {
                    this.begin();
                }
                this.processingNum++;
            }

            _doEnd() {
                this.processingNum--;
                if (this.processingNum === 0) {
                    this.end();
                }
            }


        },
        newInstance(...args) {
            return new this.Entity(...args);
        }
    };

    /**
     *
     * @param context
     * @param loadingProperty
     * @param start {=}
     * @param end {=}
     * @returns {Utils.ProcessManager.Entity}
     */
    static registerProcessLoading(context, loadingProperty, {
        start = () => undefined,
        end = () => undefined
    } = {}) {
        return this.ProcessManager.newInstance(this, {
            end() {
                context[loadingProperty] = false;
                end();
            },
            begin() {
                context[loadingProperty] = true;
                start();
            }
        });
    }

    static parseTextToCurrency(text, map = { k: 3, m: 6, w: 4 }) {
        let val = text.toString();
        val = val.toLowerCase().replace(/[^-(0-9kmKM\\.)]+/g, '');
        let times = 0;
        Object.entries(map).forEach(([k, v]) => {
            if (val.endsWith(k)) {
                times = v;
            }
        });
        let baseValue = parseFloat(val);
        baseValue *= 10 ** times;
        if (Number.isNaN(baseValue)) {
            return 0;
        }
        return baseValue;
    }

    static fromEntries(entries) {
        const result = {};
        entries.forEach(entry => {
            result[entry[0] == null ? '' : entry[0]] = entry[1];
        });
        return result;
    }

    static assignByChain(obj, chainObj) {
        Object.entries(chainObj).forEach(
            ([chain, res]) => {
                Utils.setProperty(obj, chain, res);
            }
        );
    }

    static StandardTransaction = class StandardTransaction {

        stats = [];
        cache = {
            samples: [],
            result: {},
            origin: {}
        };

        constructor({ context, samples = [] } = {}) {
            Object.assign(this, {
                getContext() {
                    return context;
                }
            });

            this.initialId = Utils.genID(7);
            this.pushStat({ id: this.initialId, samples });

            this.proxy = Utils.getProxyChain(this.virtualContext,
                ({ origin: [target, name, value], info: { parentNames = [] } }) => {
                    const [sample] = [...parentNames, name];
                    const propertyChain = [...parentNames, name].join('.');
                    this.cache.origin[propertyChain] = Utils.getProperty(this.getContext(), propertyChain);
                    this.cache.result[propertyChain] = value;
                    if (!this.cache.samples.includes(sample)) {
                        this.cache.samples.push(sample);
                    }
                    return true;
                });
        }


        resetCache() {
            this.cache.samples = [];
            this.cache.origin = {};
            this.cache.result = {};
        }

        get virtualContext() {
            return Utils.getVirtualMergeProxy([() => this.getContext(), () => {
                return this.cache.result;
            }], { usingChain: true });
        }

        get commitSize() {
            return this.stats.length;
        }

        get hasNewCommit() {
            return this.commitSize > 1;
        }

        popCurrentProxy() {
            let { samples, result, origin } = this.cache;
            result = { ...result };
            this.resetCache();
            return { samples, result, origin };
        }

        commit(params) {
            let trans = () => undefined;
            if (typeof params === 'function') {
                trans = params;
            } else {
                trans = (params || {}).trans || trans;
            }
            trans.bind(this.proxy)(this.proxy);
            const { samples, result, origin } = this.popCurrentProxy();
            const currentStat = this.getActiveCommitId();
            if (currentStat && this.getStatIndex(currentStat) < this.stats.length - 1) {
                this.revert({ id: currentStat });
            }
            Utils.assignByChain(this.getContext(), result);
            const id = this.pushStat({ samples, origin });
            this.makeActiveStat(id, true);
            return id;
        }

        pushStat({ id = Utils.genID(7), samples, origin = {} }) {
            this.stats.push(
                {
                    id,
                    data: Utils.fromEntries(
                        samples.map(sample => [sample, Utils.reflectClone(this.getContext()[sample])])
                    ),
                    origin
                }
            );
            return id;
        }

        getActiveCommitId() {
            let resultStat = null;
            this.stats.forEach(stat => {
                if (!resultStat) {
                    resultStat = stat;
                }
                if (stat.active) {
                    resultStat = stat;
                }
            });
            return (resultStat || {}).id;
        }

        makeActiveStat(id, isCommit = false) {
            const stat = this.stats.find(stat => stat.id === id);
            const oldStatId = this.getActiveCommitId();
            if (stat) {
                this.stats.forEach(stat => {
                    stat.active = false;
                });
                stat.active = true;
            }
            if (!isCommit) {
                const toIndex = this.getStatIndex(id);
                const fromIndex = this.getStatIndex(oldStatId);
                const toRight = fromIndex < toIndex;
                for (let i = fromIndex; toRight ? i <= toIndex : i >= toIndex; toRight ? (i++) : (i--)) {
                    const stat = this.stats[i];
                    if (stat) {
                        if (!toRight) {
                            if (i !== toIndex) {
                                Utils.assignByChain(this.getContext(), stat.origin);
                            } else {
                                Utils.assignByChain(this.getContext(), stat.data || {});
                            }
                        } else {
                            Utils.assignByChain(this.getContext(), stat.data || {});
                        }
                    }
                }
            }
        }

        getStatIndex(id) {
            let index = -1;
            this.stats.forEach((stat, i) => {
                if (stat.id === id) {
                    index = i;
                }
            });
            return index;
        }

        revert({ id, isAll = false } = {}) {
            if (isAll) {
                id = this.initialId;
            }
            if (!id) {
                id = (this.stats[this.getStatIndex(this.getActiveCommitId()) - 1] || {}).id;
            }
            if (id) {
                this.makeActiveStat(id);
                let keepStat = true;
                this.stats = this.stats.filter(stat => {
                    const result = keepStat;
                    keepStat = stat.id !== id && keepStat;
                    return result;
                });
            }
            return this.getActiveCommitId();
        }

        revertAll() {
            this.revert({ isAll: true });
        }

        finalize() {
            this.stats.splice(1);
            this.resetCache();
        }

    };

    static Transaction = class Transaction {
        operatorsStack = [];
        currentProxy = {};
        backupOperators = [];

        constructor(sample) {
            this.origin = sample;
            this.refreshProxy();
        }

        refreshProxy() {
            this.currentProxy = {};
            this.proxy = new Proxy(
                this.currentProxy, {
                    set: (target, property, value, receiver) => {
                        this.backupOperators.push(
                            {
                                target: this.origin,
                                property,
                                value: this.proxy[property],
                                receiver: this.origin
                            }
                        );
                        return Reflect.set(target, property, value, receiver);
                    },
                    get: (target, p, receiver) => {
                        if (Reflect.has(target, p)) {
                            return Reflect.get(target, p, receiver);
                        }
                        return Reflect.get(this.origin, p, this.origin);
                    },
                    originTarget: this.origin
                }
            );
        }

        commit(doOperator = () => undefined) {
            doOperator.call(this.proxy, this.proxy);
            Object.assign(this.origin, this.currentProxy);
            this.operatorsStack.push(this.backupOperators);
            this.backupOperators = [];
            this.refreshProxy();
        }

        revert() {
            const operators = this.operatorsStack.pop();
            if (!operators) {
                return false;
            }
            let operator = operators.pop();
            while (operator) {
                const { target, value, property, receiver } = operator;
                Reflect.set(target, property, value, receiver);
                operator = operators.pop();
            }
            return true;
        }

        revertAll() {
            if (this.revert()) {
                this.revertAll();
            }
        }

        commitSize() {
            return this.operatorsStack.length;
        }

        finalize() {
            this.operatorsStack = [];
            this.backupOperators = [];
        }
    };

    static getTransaction(target) {
        return new this.StandardTransaction({ context: target });
    }

    static getStrHashCode(str) {
        str += '';
        let hash = 0, i, chr, len;
        if (str.length === 0) return hash;
        for (i = 0, len = str.length; i < len; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash + '';
    }

    static getHashCode(obj, stringify = false, deep = 10) {
        if (stringify) {
            return this.getStrHashCode(JSON.stringify(obj));
        }
        return this.getStrHashCode(
            this.getKeyValues(obj, deep).join('')
        );
    }

    static getKeyValues(obj, deep = 10) {
        if (deep <= 0) {
            return [];
        }
        if (!obj || ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date) {
            return [obj];
        }
        deep = deep - 1;

        return this.flat(
            Object.entries({ ...Array.isArray(obj) ? [...obj] : obj }).map(([key, value]) => [key, this.getKeyValues(value, deep)]), deep
        ).filter(r => r != null && r !== '');
    }

    static getPropertyNames(_self, deep = 10) {
        if (deep <= 0) {
            return '';
        }
        if (!_self || ['string', 'number', 'boolean', 'function'].includes(typeof _self) || _self instanceof Date) {
            return '';
        }
        deep = deep - 1;
        return this.flat(
            Object.entries(_self).map(([key, value]) => [key, this.getPropertyNames(value, deep)]), deep
        ).filter(r => r != null && r !== '');
    }

    static getStorage = (prefix, isLocal = true) => ({
        getItem(key) {
            let itemStr = (isLocal ? localStorage : sessionStorage).getItem(prefix + key);
            let result = null;
            try {
                result = JSON.parse(itemStr);
            } catch (e) {
                console.log(`No valid item for key [${key}] to get in storage.`);
            }
            return result;
        },
        setItem(key, value) {
            let result = null;
            try {
                result = JSON.stringify(value);
                (isLocal ? localStorage : sessionStorage).setItem(prefix + key, result);
                const keys = ((isLocal ? localStorage : sessionStorage).getItem(prefix + '___ggg__keys') || '').split(',');
                if (!keys.includes(key.trim())) {
                    keys.push(key);
                    (isLocal ? localStorage : sessionStorage).setItem(prefix + '___ggg__keys', keys.join(','));
                }
            } catch (e) {
                console.warn(`Not valid item for key [${key}] to set.`);
            }
        },
        removeItem(key) {
            (isLocal ? localStorage : sessionStorage).removeItem(prefix + key);
        },
        getKeys() {
            return ((isLocal ? localStorage : sessionStorage).getItem(prefix + '___ggg__keys') || '').split(',');
        }
    });

    static convertBoolean(obj) {
        if (typeof obj === 'string' && obj.trim()) {
            try {
                return !!JSON.parse(obj.trim());
            } catch (e) {
                return !!obj;
            }
        }
        return !!obj;
    }

    static navigateTo(pageRef) {
        const navigator = new (NavigationMixin(LightningElement))();
        navigator[NavigationMixin.Navigate](pageRef);
    }

    static Math = {
        sum: (...args) => args.reduce((sum, num) => sum + (parseFloat(num) || 0), 0),
        dValue: (a, b) => parseFloat(a || 0) - parseFloat(b || 0)
    };

    static isBlank(str) {
        return str == null || str.trim() === '';
    }

    static isNotBlank(str) {
        return !this.isBlank(str);
    }

    static keepDecimal(num = 0, decimal = 2) {
        return parseFloat(parseFloat(num).toFixed(decimal));
    }

    static registerDOMEvent(dom, eventName, callback) {
        if (dom.addEventListener) {
            dom.addEventListener(eventName, callback);
        }
        const id = this.genID(7);
        DOMEventMapper[id] = { dom, eventName, callback };
        // console.log(`Event name [${eventName}] registered [eventId: ${id}]`);
        return id;
    }

    static removeDOMEvent(eventId) {
        if (eventId) {
            const { dom, eventName, callback } = DOMEventMapper[eventId] || {};
            if (dom && dom.removeEventListener) {
                dom.removeEventListener(eventName, callback);
                delete DOMEventMapper[eventId];
                // console.log(`Event name [${eventName}] removed [eventId: ${eventId}]`);
            }
        }
    }

    static generateClassName(...args) {
        args = this.flat(args);
        const classNames = [];
        for (let arg of args) {
            if (typeof arg === 'function') {
                arg = arg();
            }
            if (typeof arg === 'string') {
                classNames.push(arg);
            } else if (typeof arg === 'object') {
                Object.entries(arg).forEach(([className, valid]) => {
                    if (valid) {
                        classNames.push(className);
                    }
                });
            }
        }
        return classNames.join(' ').replace(/[\s\t\r\n]+/g, ' ').trim();
    }

    static cloneObject(obj, deep = 10) {
        if (deep < 0 || ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date || obj == null) {
            return obj;
        }
        const result = Utils.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, this.cloneObject(value, deep - 1)])
        );
        return obj instanceof Array ? Array.of(...Object.values(result)) : result;
    }

    static cloneObjectES6(obj, deep = 10) {
        if (deep < 0 || ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date || obj == null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return [...obj].map(o => this.cloneObjectES6(o, deep - 1));
        }
        return Utils.fromEntries(Object.entries({ ...obj }).map(([key, value]) => [key, this.cloneObjectES6(value, deep - 1)]));
    }

    static reflectClone(obj, deep = 10) {
        if (deep < 0 || ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date || obj == null) {
            return obj;
        }
        const keys = Reflect.ownKeys(obj);

        const result = this.fromEntries(
            keys.map(key => [key, this.reflectClone(Reflect.getOwnPropertyDescriptor(obj, key).value, deep - 1)])
        );

        if (Array.isArray(obj)) {
            return Array.from(result);
        }
        return result;
    }

    static isBasicDataType(obj) {
        return ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date || obj == null;
    }

    static getVirtualMergeProxy(contexts = [], { usingChain = false } = {}) {

        if (!contexts || contexts.length === 0) {
            return {};
        }

        function isBasicDataType(obj) {
            return ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date || obj == null;
        }

        function hasProperty(obj, p) {
            return Object.getOwnPropertyNames(obj).includes(p) || obj[p] !== undefined;
        }

        const getReal = (contexts, p) => {
            return [...contexts].reverse().map(context => context[p]) || [];
        };

        const getFn = (contexts, p) => {
            const isGetReal = typeof p === 'string' && p.startsWith('_$');
            if (isGetReal) {
                p = p.slice(2);
            }
            contexts = contexts.map(c => ({ fn: c, value: c() }));
            if (usingChain) {
                contexts = contexts.map((context, i) => {
                    const c = context.value;
                    if (i === 0) {
                        return context;
                    }
                    const res = {};
                    Object.entries(c).forEach(([chain, value]) => {
                        this.setProperty(res, chain, value);
                    });
                    return { value: res, fn: context.fn };
                });
            }
            const validContexts = contexts.filter(c => hasProperty(c.value, p));
            const values = getReal(validContexts.map(c => c.value), p);
            const [realValue] = values;
            if (isBasicDataType(realValue)) {
                return realValue;
            }
            if (isGetReal) {
                return values.reverse().reduce((result, v) => {
                    if (typeof v === 'object') {
                        if (Array.isArray(v)) {
                            v = [...v];
                        } else {
                            v = { ...v };
                        }
                        return result == null ? v : Utils.deeplyAssign(result, v);
                    }
                    return result;
                });
            }
            const selectedContexts = contexts.map(({ fn }, i) => () => {
                const v = fn();
                if (usingChain && i !== 0) {
                    const res = {};
                    Object.entries(v).forEach(([chain, value]) => {
                        this.setProperty(res, chain, value);
                    });
                    return res[p] || {};
                }
                return v[p] || {};
            });
            return new Proxy({}, {
                get: (target, p1) => getFn(selectedContexts, p1),
                set: () => false
            });
        };

        return new Proxy({}, {
            get: (target, p) => getFn(contexts, p),
            set: () => false
        });
    }

    static deeplyAssign(origin, target, {
        deep = 10,
        allProperty = false,
        reassign = true
    } = {}) {
        if (deep < 1) {
            Object.assign(origin, target);
            return origin;
        }
        const keysMethodName = allProperty ? 'getOwnPropertyNames' : 'keys';
        const originKeys = Object.getOwnPropertyNames(origin);
        const targetKeys = Object[keysMethodName](target);

        function isBasicDataType(obj) {
            return ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date || obj == null;
        }

        for (const key of targetKeys) {
            const ofTarget = target[key];
            if (!originKeys.includes(key) && origin[key] === undefined) {
                origin[key] = ofTarget;
                continue;
            }
            const ofOrigin = origin[key];
            if (isBasicDataType(ofOrigin) || isBasicDataType(ofTarget)) {
                origin[key] = ofTarget;
                continue;
            }
            origin[key] = this.deeplyAssign(ofOrigin, ofTarget, { deep: deep - 1, allProperty });

        }
        return origin;
    }

    static generateConverter(typeConstructor = () => undefined, originData = {}) {
        if (typeof originData !== 'object') {
            originData = {};
        }
        return new Proxy(
            {},
            {
                get: (target, property) => {
                    return typeConstructor(originData[property]);
                }
            }
        );
    }

    static generateStrategyMapper(mapper = {}, defaultValue, ignoreCase = false) {
        return new Proxy({ ...mapper }, {
            get(target, p, receiver) {
                if (Object.getOwnPropertyNames(target)
                    .map(name => ignoreCase ? name.toLowerCase() : name).includes(ignoreCase ? p.toLowerCase() : p)) {
                    return Reflect.get(target, p, receiver);
                }
                return defaultValue;
            }
        });
    }

    static stringEquals(str, compered) {
        return str + '' === compered + '';
    }

    static parseWeek(weekFormat) {
        if (weekFormat) {
            const year = weekFormat.slice(0, 4);
            const week = weekFormat.slice(4);
            return this.getProxyParsingNumber({ year, week });
        }
        return { year: 1900, week: 1 };
    }

    static fixedNumber(numberStr, fixSize) {
        numberStr = numberStr + '';
        if (numberStr.length < fixSize) {
            Array.from({ length: fixSize - numberStr.length }).forEach(
                () => {
                    numberStr = '0' + numberStr;
                }
            );
        }
        return numberStr;
    }

    static getPastWeek(weekFormat) {
        let { year, week } = this.parseWeek(weekFormat);
        year = week - 1 > 0 ? year : year - 1;
        week = week - 1 > 0 ? week - 1 : this.getWeeksSizeOfYear(year);
        return this.fixedNumber(year, 4) + this.fixedNumber(week, 2);
    }


    static getWeeksSizeOfYear(year) {
        const yearStartDate = new Date(year, 0, 1);
        const yearEndDate = new Date(year, 11, 31);

        let weeks = 0;
        if (yearStartDate.getDay() !== 0) {
            weeks++;
            yearStartDate.setDate(yearStartDate.getDate() + (7 - yearStartDate.getDay()) % 7);
        }
        if (yearEndDate.getDay() !== 0) {
            weeks++;
            yearEndDate.setDate(yearEndDate.getDate() - yearEndDate.getDay());
        }

        weeks += Math.floor((yearEndDate.getTime() - yearStartDate.getTime()) / (3600 * 24 * 7000));
        return weeks;
    }

    /**
     *
     * @param date{Date=}
     */
    static getPercentFromDayOfYear(date = new Date()) {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const endDate = new Date(date.getFullYear(), 11, 30);

        const allDays = this.daysBetween(startDate, endDate);
        const pastDays = this.daysBetween(startDate, date);
        return pastDays / allDays;
    }

    static autoReplaceEmptyData(data = [], cb = ({ data = [], index = 0 } = {}) => {

        if (index === 0 || index >= data.length - 1) {
            return undefined;
        }

        let lastValue = data[index - 1], nextValue;
        let i = index + 1;
        for (; i < data.length; i++) {
            if (data[i] != null) {
                nextValue = data[i];
                break;
            }
        }
        if (i === data.length || lastValue == null) {
            return undefined;
        }
        const distance = i - index + 1; // 1 means self


        return (nextValue - lastValue) / distance + lastValue;

    }) {
        return [...data].reduce(
            (array, d, i) => {
                if (d == null) {
                    array[i] = cb({ data: array, index: i });
                }
                return array;
            }, [...data]
        );
    }

    static compareQuarter(q1 = '', q2 = '') {
        let q1year = parseInt(q1.split('Q')[0], 10);
        let q1q = parseInt(q1.split('Q')[1], 10);
        let q2year = parseInt(q2.split('Q')[0], 10);
        let q2q = parseInt(q2.split('Q')[1], 10);
        if (q1year !== q2year) {
            return q1year - q2year;
        }
        return q1q - q2q;
    }

    static isDebugModel() {
        const testFunction = () => {
            const result = 100;
            return result;
        };
        return testFunction.toString().replace(/[\s\t\n\r]+/g, ' ') === `() => { const result = 100; return result; }`;
    }

    static IdentityAction = class {

        identityMapper = {};

        wrap(action) {
            const [key, func] = Object.entries(action)[0] || [];
            if (!key) {
                return func;
            }
            func.identity = (
                {
                    identityGenerator = Utils.genID,
                    local = '',
                    rejectValue = NONE_PROMISE_RESPONSE
                } = {}
            ) => {
                const _this = this;
                return function(...args) {
                    const hashcode = Utils.getHashCode({ action, local });
                    const identity = identityGenerator();
                    _this.identityMapper[hashcode] = {
                        identity
                    };
                    return new Promise((resolve, reject) => {
                        func.bind(this)(...args)
                            .then(res => {
                                const realtimeIdentity = (_this.identityMapper[hashcode] || {}).identity;
                                if (realtimeIdentity === identity) {
                                    resolve(res);
                                    return res;
                                }
                                console.log('invalid request', key);
                                reject(rejectValue);
                                return null;
                            })
                            .catch(e => {
                                const realtimeIdentity = (_this.identityMapper[hashcode] || {}).identity;
                                if (realtimeIdentity === identity) {
                                    reject(e);
                                    return e;
                                }
                                console.log('invalid request', key);
                                reject(rejectValue);
                                return null;
                            });
                    });
                };
            };
            return func;
        }

        static removeAdditionalParams(params = []) {
            if (!params[0]) {
                return params;
            }
            const additionalRegexp = [
                /.*refresh.*/i,
                /.*_cacheid.*/i
            ];
            const p = params[0];
            params[0] = Utils.fromEntries(
                Object.entries(p).filter(([key]) =>
                    additionalRegexp.reduce((is, regx) => {
                        return !key.toLowerCase().match(regx) && is;
                    }), true)
            );
            return params;
        }
    };

    /**
     * @param _array {Array}
     * @param minLeft {number=0}
     * @param minRight {number=0}
     * @param paddingItem {*=undefined}
     * @param total {number=}
     * @param leftFirst {boolean=true}
     * @param infectSelf {boolean=false}
     * @return {*[]}
     */
    static paddingFromArray(
        _array = [], {
            minLeft = 0,
            minRight = 0,
            paddingItem,
            total,
            leftFirst = true,
            infectSelf = false
        } = {}) {
        const minTotal = _array.length + minLeft + minRight;
        if (!total || total < minTotal) {
            total = minTotal;
        }
        const leftItems = Array.from({ length: minLeft }).map(() => paddingItem);
        const rightItems = Array.from({ length: minRight }).map(() => paddingItem);
        if (total > minTotal) {
            const extraItems = Array.from({ length: total - minTotal }).map(() => paddingItem);
            if (leftFirst) {
                leftItems.push(...extraItems);
            } else {
                rightItems.push(...extraItems);
            }
        }
        if (infectSelf) {
            _array.unshift(...leftItems);
            _array.push(...rightItems);
            return _array;
        }
        return [...leftItems, ..._array, ...rightItems];
    }

    static trimArray(
        _array,
        {
            emptyItems = [undefined, null],
            maxLeft = Infinity, maxRight = Infinity,
            trimLength = 0,
            leftFirst = true,
            infectSelf = false
        } = {}) {
        const length = _array.length;
        const endIndex = length - 1;
        const maxLength = length - maxLeft - maxRight;
        if (trimLength < maxLength) {
            trimLength = maxLength < 0 ? 0 : maxLength;
        }

        let leftIndex = 0, rightIndex = endIndex;
        const maxLeftIndex = leftIndex + maxLeft;
        const maxRightIndex = rightIndex - maxRight;
        let leftEnd = false, rightEnd = false;

        while (rightIndex - leftIndex > trimLength - 1 && (!leftEnd || !rightEnd)) {
            const leftItem = _array[leftIndex];
            const rightItem = _array[rightIndex];
            const maxLeftDone = maxLeftIndex <= leftIndex;
            const maxRightDone = maxRightIndex >= rightIndex;

            const firstItem = leftFirst ? leftItem : rightItem;
            const secondItem = leftFirst ? rightItem : leftItem;
            let firstEnd = leftFirst ? leftEnd : rightEnd;
            let secondEnd = leftFirst ? rightEnd : leftEnd;
            const firstDone = leftFirst ? maxLeftDone : maxRightDone;
            const secondDone = leftFirst ? maxRightDone : maxLeftDone;

            if (!firstEnd) {
                if (
                    emptyItems.reduce((equals, item) => {
                        return equals || item === firstItem;
                    }, false) && !firstDone
                ) {
                    if (leftFirst) {
                        leftIndex++;
                    } else {
                        rightIndex--;
                    }
                } else {
                    firstEnd = true;
                }
            } else {
                if (
                    emptyItems.reduce((equals, item) => {
                        return equals || item === secondItem;
                    }, false) && !secondDone
                ) {
                    if (leftFirst) {
                        rightIndex--;
                    } else {
                        leftIndex++;
                    }
                } else {
                    secondEnd = true;
                }
            }

            if (leftFirst) {
                leftEnd = firstEnd;
                rightEnd = secondEnd;
            } else {
                rightEnd = firstEnd;
                leftEnd = secondEnd;
            }
        }

        if (infectSelf) {
            _array.splice(rightIndex + 1);
            _array.splice(0, leftIndex);
            return _array;
        }

        return _array.slice(leftIndex, rightIndex + 1);

    }

    static trimArrayLeft(_array, option = {}) {
        option.leftFirst = true;
        option.maxRight = 0;
        return this.trimArray(_array, option);
    }

    static trimArrayRight(_array, option = {}) {
        option.leftFirst = false;
        option.maxLeft = 0;
        return this.trimArray(_array, option);
    }


    /**
     * @param _array {Array}
     * @param total {number}
     * @param paddingItem {*=undefined}
     * @param option {Object=}
     */
    static paddingLeftFromArray(_array, total, paddingItem, option = {}) {
        option.leftFirst = true;
        option.total = total;
        option.paddingItem = paddingItem;
        return this.paddingFromArray(_array, option);
    }

    /**
     * @param _array {Array}
     * @param total {number}
     * @param paddingItem {*=undefined}
     * @param option {Object=}
     */
    static paddingRightFromArray(_array, total, paddingItem, option = {}) {
        option.leftFirst = false;
        option.total = total;
        option.paddingItem = paddingItem;
        return this.paddingFromArray(_array, option);
    }

    /**
     *
     * @param target
     * @param options
     * @return readonly target
     */
    static getReferenceProxy = configure;

    static parseFunctionFields(obj) {
        const result = {};
        for (const key of Object.keys(obj)) {
            result[key] = this.parseFunction(obj[key]);
        }
        return result;
    }

    static parseFunction(obj) {
        if (obj instanceof Function) {
            return obj;
        }
        return function() {
            return obj;
        };
    }

    static replaceKey(obj, keyMapper) {
        return this.fromEntries(
            Object.entries(obj)
                .map(([key, value]) => {
                    if (key in keyMapper) {
                        key = keyMapper[key];
                    }
                    return [key, value];
                })
        );
    }

    static template(_self, context, options) {
        const opts = Object.assign({}, defaultOptions, options);
        const { prefix, suffix, withFunction } = opts;
        const { raws = [], expressions = [] } = getBindingExpressions(_self, prefix, suffix);
        if (expressions.length === 0) {
            return _self;
        }
        return joinWith(raws, (index) => {
            const expression = expressions[index] || '';
            if (withFunction) {
                return _execExpression(expression, context) || '';
            }
            return this.getProperty(context, expression.trim()) || '';
        });
    }


}

