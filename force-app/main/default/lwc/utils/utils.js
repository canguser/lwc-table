/**
 * Created by ryan on 2019-07-25.
 */
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { LightningElement } from 'lwc';

const DOMEventMapper = {};

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
                places = 2;
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

    static autoFormatCurrency(num, symbol = '$', picklist = [
        {
            places: 2,
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

    /**
     * get proxy from a object, any properties is treated as numbers
     * tip: if the property can not parse to number or the result is NaN, the result is default 0.
     * @param obj
     * @returns {{}}
     */
    static getProxyParsingNumber(obj) {
        if (!(obj instanceof Object || typeof obj === 'object') || !obj) {
            obj = {};
        }
        return new Proxy({...obj}, {
            get(target, key) {
                if (Number.isNaN(parseFloat(obj[key]))) {
                    return 0;
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

    static genID = (length) => {
        return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36);
    };

    static success(context, ...args) {
        this.showToast(context, args, { type: 'success' });
    }

    static error(context, ...args) {
        console.log(args);
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

    static daysBetween(sDate1, sDate2) {
        let dateSpan,
            iDays;
        sDate1 = Date.parse(sDate1);
        sDate2 = Date.parse(sDate2);
        dateSpan = sDate2 - sDate1;
        dateSpan = Math.abs(dateSpan);
        iDays = Math.floor(dateSpan / (24 * 3600 * 1000));
        return iDays;
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
        if (!(target instanceof Object)) {
            return target;
        }
        return new Proxy(target, {
            get: (t, name) => {
                if (typeof name === 'string' && name.startsWith('$')) {
                    return target[name.replace('$', '')];
                }
                return this.getProxyChain(t[name], set, keepNull, [...parentNames, name]);
            },
            set: (t, name, value, receiver) => {
                t[name] = value;
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
            setTimeout(() => {
                (async () => {
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
            setTimeout(() => {
                resolve(params);
            }, ms);
        });
    }

    static delay(context, apiName, ms) {
        const eqName = `_delay_${apiName}`;
        clearTimeout(context[eqName]);
        return new Promise(resolve => {
            context[eqName] = setTimeout(() => {
                resolve(true);
            }, ms);
        });
    }

    static capitalizes(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static ProcessManager = {
        Entity: class {

            processingNum = 0;

            constructor(context, { begin = () => undefined, end = () => undefined }) {
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
                        reject(e);
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
            result[entry[0] || ''] = entry[1];
        });
        return result;
    }

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
        return new this.Transaction(target);
    }

    static getStrHashCode(str) {
        let hash = 0, i, chr, len;
        if (str.length === 0) return hash;
        for (i = 0, len = str.length; i < len; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash + '';
    }

    static getHashCode(obj) {
        return this.getStrHashCode(
            this.getKeyValues(obj).join('')
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
            Object.entries(obj).map(([key, value]) => [key, this.getKeyValues(value, deep)]), deep
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

    static getStorage = (prefix) => ({
        getItem(key) {
            let itemStr = localStorage.getItem(prefix + key);
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
                localStorage.setItem(prefix + key, result);
                const keys = (localStorage.getItem(prefix + '___ggg__keys') || '').split(',');
                if (!keys.includes(key.trim())) {
                    keys.push(key);
                    localStorage.setItem(prefix + '___ggg__keys', keys.join(','));
                }
            } catch (e) {
                console.log(`Not valid item for key [${key}] to set.`);
            }
        },
        removeItem(key) {
            localStorage.removeItem(prefix + key);
        },
        getKeys() {
            return (localStorage.getItem(prefix + '___ggg__keys') || '').split(',');
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
        sum: (...args) => {
            return args.reduce((sum, num) => sum + (parseFloat(num) || 0), 0);
        }
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
        console.log(`Event name [${eventName}] registered [eventId: ${id}]`);
        return id;
    }

    static removeDOMEvent(eventId) {
        if (eventId) {
            const { dom, eventName, callback } = DOMEventMapper[eventId] || {};
            if (dom.removeEventListener) {
                dom.removeEventListener(eventName, callback);
                delete DOMEventMapper[eventId];
                console.log(`Event name [${eventName}] removed [eventId: ${eventId}]`);
            }
        }
    }

    static cloneObject(obj, deep = 10) {
        if (deep < 0 || ['string', 'number', 'boolean', 'function'].includes(typeof obj) || obj instanceof Date) {
            return obj;
        }
        const result = Utils.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, this.cloneObject(value, deep - 1)])
        );
        return obj instanceof Array ? Array.of(...Object.values(result)) : result;
    }

}