/**
 * Created by ryan on 2019/12/12.
 */
import Constants from 'c/constants';
import Utils from 'c/utils';
// eslint-disable-next-line import/named
// const db = Promise.resolve();
const METHOD_RESULT_TEMPLATE = {
    method: '',
    cacheMap: {}
};

const DATA_RESULT_TEMPLATE = {
    method: '',
    params: [],
    hashCode: undefined,
    data: undefined,
    timestamp: undefined,
    type: 'resolve' // 'future'
};

const actionsStartHandlersMap = {};
const actionsEndHandlersMap = {};

const registerMap = {};
const registerHandler = {};
let isOnline = window.navigator ? window.navigator.onLine : true;

const executingMap = {};

const storage = Utils.getStorage(Constants.LOCAL_CACHE_PREFIX, false);

const usingDB = false; // LWC not support indexedDB.........

const openPreCache = false;

const cacheDB = usingDB ? Promise.resolve() : null;

export const identityAction = new Utils.IdentityAction();

const deployContainerMap = {};

const DelayContainer = class {
    delayPolls = [];

    delaySize = 6;

    delayWaitMS = 0;

    maxSize = 12;

    isChecking = false;

    maxWaitMS = 500;

    async checkToReleasePoll() {
        this.isChecking = true;
        await Promise.resolve();
        while (this.delayPolls.length > 0) {
            const isEmpty = await this.doReleasePoll();
            if (isEmpty) {
                break;
            }
            await Utils.waitFrame();
        }
        this.isChecking = false;
    }

    async doReleasePoll() {
        if (this.delayPolls.length > 0) {
            const delays = this.delayPolls.length <= this.maxSize ? this.delayPolls.splice(0, this.maxSize) : this.delayPolls.splice(0, this.delaySize);
            const waitPromise = Promise.all(delays.map(
                delay => Promise.resolve(delay())
            ));
            await Promise.race([waitPromise, Utils.wait(this.maxWaitMS)]);
            return this.delayPolls.length === 0;
        }
        return true;
    }

    async waitDelay(cb) {
        this.delayPolls.push(cb);
        if (!this.isChecking) {
            this.checkToReleasePoll();
        }
    }
};


class LocalCacheService {

    static DeployContainer = DelayContainer;

    static getDeployContainer(id = Utils.genID(7)) {
        const result = deployContainerMap[id];
        if (!result || !(result instanceof DelayContainer)) {
            deployContainerMap[id] = new DelayContainer();
        }
        return deployContainerMap[id];
    }

    /**
     * @param actionMap {Object}
     * @param type
     * @param cacheCallback
     * @return {function}
     */
    static convertCachedAction(actionMap, type = 'resolve', cacheCallback = false) {
        const _this = LocalCacheService;
        const keys = Object.keys(actionMap);
        if (cacheCallback) {
            return function(callback) {
                const key = keys[0];
                return identityAction.wrap(
                    {
                        [key]: function(...args) {
                            if (!openPreCache) {
                                return _this.convertCachedAction(actionMap, type, false)(...args);
                            }
                            return _this.resolveCachedData({
                                method: keys[0],
                                params: [...args],
                                type
                            }).then(cachedResult => {
                                if (cachedResult && typeof callback === 'function') {
                                    // console.log('Pre cache:', cachedResult);
                                    callback(cachedResult);
                                }
                            }).then(() => {
                                return _this.convertCachedAction(actionMap, type, false)(...args);
                            });
                        }
                    });
            };
        }
        if (keys.length > 0) {
            const key = keys[0];
            registerMap[key] = actionMap[key];
            return identityAction.wrap(
                {
                    [key]: function(...args) {

                        if (type === 'future' && !isOnline) {
                            _this.saveCachedData({
                                method: key,
                                params: [...args],
                                type
                            }).catch(e => {
                                console.log('save cache failure', e);
                            });
                        }

                        return _this.registerExecutingMap(actionMap, type, args, this)
                            .then(data => {
                                if (type === 'resolve') {
                                    _this.saveCachedData({
                                        method: key,
                                        params: [...args],
                                        data
                                    }).catch(e => console.log(e));
                                }
                                return data;
                            })
                            .catch(e => {
                                if (e.status && e.status === 400) {
                                    if (type === 'resolve') {
                                        return _this.resolveCachedData({
                                            method: key,
                                            params: [...args],
                                            type
                                        });
                                    }
                                    if (type === 'future') {
                                        return { isFuture: true };
                                    }
                                }
                                return Promise.reject(e);
                            });
                    }
                }
            );
        }
        return () => Promise.resolve();
    }

    static registerHandlerWhenMethodInvoke(method, handler) {
        let handlers = registerHandler[method];
        if (!handlers) {
            handlers = [];
        }
        handlers.push(handler);
        registerHandler[method] = handlers;
    }

    static async execWaitedMethod() {
        if (!isOnline) {
            return Promise.resolve();
        }
        const methods = storage.getKeys() || [];
        const validMethods = methods.filter(
            m => typeof registerMap[m] === 'function' && storage.getItem(m)
        );
        const cachedQueue = validMethods.reduce((queue, m) => {
            const methodCached = storage.getItem(m);
            const cachedQueue = Object.values(methodCached.cacheMap).filter(cache => cache.type === 'future');
            methodCached.cacheMap = Utils.fromEntries(
                Object.entries(methodCached.cacheMap).filter(([key, cache]) => cache.type !== 'future')
            );
            storage.setItem(m, methodCached);
            return queue.concat(cachedQueue);
        }, []).sort((a, b) => a.timestamp - b.timestamp);
        const results = [];
        for (const action of cachedQueue) {
            try {
                results.push(
                    {
                        action,
                        returnValue: await registerMap[action.method].call(this, ...action.params),
                        isSuccess: true,
                        method: action.method
                    }
                );
            } catch (e) {
                results.push(
                    {
                        action,
                        isSuccess: false,
                        error: e,
                        method: action.method
                    }
                );
            }
        }
        return results;
    }

    static async resolveCachedData(
        {
            method = '',
            params = [],
            type = 'resolve'
        }
    ) {
        LocalCacheService.removeAdditionalParams(params);
        const hashCode = Utils.getHashCode({ method, params, type });

        if (usingDB) {
            const cDB = await cacheDB;
            const result = ((await cDB.where('hashcode').equals(hashCode).first()) || {});
            return result.data;
        }

        let item = storage.getItem(method);
        const result = { ...METHOD_RESULT_TEMPLATE, ...item }.cacheMap[hashCode] || undefined;
        // console.log(method, params, result.data, hashCode);
        return result && result.data;
    }

    static async saveCachedData(
        {
            method = '',
            params = [],
            data = undefined,
            type = 'resolve'
        }
    ) {
        LocalCacheService.removeAdditionalParams(params);
        const hashCode = Utils.getHashCode({ method, params, type });

        if (usingDB) {
            const cDB = await cacheDB;
            return cDB.put({
                hashcode: hashCode,
                methodName: method,
                data, type, params
            }).catch(e => console.log(e));
        }

        let item = storage.getItem(method);
        item = { ...METHOD_RESULT_TEMPLATE, cacheMap: {}, ...item };
        if (!item.method) {
            item.method = method;
        }
        if (item.method !== method) {
            // console.log(item, method);
        }
        item.cacheMap[hashCode] = {
            ...DATA_RESULT_TEMPLATE,
            timestamp: Date.now(),
            hashCode: hashCode,
            data: data,
            method,
            params, type
        };

        // get all methods
        let methods = storage.getItem(Constants.LOCAL_CACHE_METHOD_LIST) || [];
        if (methods && methods instanceof Array) {
            if (!methods.includes(method)) {
                methods.push(method);
            }
        } else {
            methods = [method];
        }

        try {
            storage.setItem(Constants.LOCAL_CACHE_METHOD_LIST, methods);
            storage.setItem(method, item);
        } catch (e) {
            this.removeFarthestCache();
            storage.setItem(Constants.LOCAL_CACHE_METHOD_LIST, methods);
            storage.setItem(method, item);
        }

        return null;
    }

    static getAllCache() {
        const methods = storage.getItem(Constants.LOCAL_CACHE_METHOD_LIST) || [];
        return methods.map(method => storage.getItem(method));
    }

    static removeFarthestCache(size = 20) {
        const allCache = this.getAllCache() || [];
        const cacheList = Utils.flat(
            allCache.map(c => c.cacheMap)
                .map(cacheMap => Object.values(cacheMap)), 1
        ).sort((a, b) => a.timestamp - b.timestamp);
        const deleteHashList = cacheList.slice(0, size).map(c => c.hashCode);
        allCache.forEach(
            c => {
                c.cacheMap = Utils.fromEntries(
                    Object.entries(c.cacheMap)
                        .filter(([key]) => !deleteHashList.includes(key))
                );
            }
        );
        allCache.forEach(cache => storage.setItem(cache.method, cache));
    }

    static removeAdditionalParams = Utils.IdentityAction.removeAdditionalParams;

    static isOnline() {
        return isOnline;
    }

    static checkWaitedMethod() {
        if (!isOnline) {
            return;
        }
        LocalCacheService.execWaitedMethod().then(results => {
            const handledMethods = Object.keys(registerHandler);
            const handlerParamsMap = {};
            results.forEach(result => {
                if (handledMethods.includes(result.method)) {
                    let params = handlerParamsMap[result.method];
                    if (!params) {
                        params = [];
                    }
                    params.push(result);
                    handlerParamsMap[result.method] = params;
                }
            });
            Object.keys(handlerParamsMap).forEach(m => {
                const methods = registerHandler[m];
                methods.forEach(method => {
                    method(handlerParamsMap[m] || []);
                });
            });
        }).catch(e => {
            console.log('online invoke exception:', e);
        });
    }

    static registerExecutingMap(actionMap, type, args, context) {
        const key = Object.keys(actionMap)[0];
        const action = actionMap[key];

        const hashCode = Utils.getHashCode({
            method: key,
            params: this.removeAdditionalParams([...args]),
            type
        });

        if (executingMap[hashCode] && executingMap[hashCode].hookBackList) {
            return new Promise((resolve, reject) => {
                executingMap[hashCode].hookBackList.push(
                    (error, result) => {
                        // console.log(hashCode, 'get from cache');
                        if (error) {
                            reject(result);
                        } else {
                            resolve(result);
                        }
                    }
                );
            });
        }
        executingMap[hashCode] = {
            hookBackList: [],
            method: key,
            start: Date.now()
        };
        if (this.isExecutingStart()) {
            Object.values(actionsStartHandlersMap).forEach(
                (handlers = []) => handlers.forEach(
                    handler => handler({ ...executingMap })
                ));
        }

        const parseResult = (isError, res) => {
            executingMap[hashCode].hookBackList.forEach(back => back(isError, res));
            executingMap[hashCode] = null;
            if (this.isExecutingEnd()) {
                Object.values(actionsEndHandlersMap).forEach(
                    (handlers = []) => handlers.forEach(
                        handler => handler()
                    ));
            }
        };

        return Promise.resolve(action.bind(context)(...args)).then(
            res => {
                // console.log(hashCode, 'get from service', res, args);
                parseResult(false, res);
                return res;
            }
        ).catch(e => {
            parseResult(true, e);
            return Promise.reject(e);
        });
    }

    static registerActionsStart(key, callback) {
        const { handlers = [] } = actionsStartHandlersMap;
        handlers.push(callback);
        actionsStartHandlersMap[key] = handlers;
    }

    static registerActionsEnd(key, callback) {
        const { handlers = [] } = actionsEndHandlersMap;
        handlers.push(callback);
        actionsEndHandlersMap[key] = handlers;
    }

    static isExecutingStart() {
        return Object.values(executingMap).filter(value => value).length === 1;
    }

    static isExecutingEnd() {
        return Object.values(executingMap).filter(value => value).length === 0;
    }

    static ActionPreLoader = class {

        preCache = {};
        identitySymbol = Symbol();

        constructor(func) {
            this.func = func;
        }

        async preLoad(...params) {
            const paramsHash = Utils.getHashCode(params);
            try {
                // later
                await Promise.resolve();
                const result = await Promise.resolve(
                    this.func(...params)
                );
                this.preCache[paramsHash] = {
                    data: result,
                    timestamp: Date.now()
                };
            } catch (ignore) {
                delete this.preCache[paramsHash];
                // ignore
            }
        }

        getCacheByHashcode(hashcode) {
            let result = this.identitySymbol;
            if (hashcode in this.preCache) {
                const timestamp = Date.now();
                const offset = 300000; // 5min
                const targetCache = this.preCache[hashcode];
                if (timestamp <= targetCache.timestamp + offset) {
                    result = targetCache;
                }
                delete this.preCache[hashcode];
            }
            return result;
        }

        convert() {
            const _this = this;
            return function(...params) {
                const paramsHash = Utils.getHashCode(params);
                const cache = _this.getCacheByHashcode(paramsHash);
                if (cache === _this.identitySymbol || !cache) {
                    return _this.func(...params);
                }
                return Promise.resolve(cache.data);
            };
        }
    };
}

window.addEventListener('online', () => {
    isOnline = true;
    LocalCacheService.checkWaitedMethod();
    console.log('online now.');
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('offline now.');
});

export default LocalCacheService;