import Utils from 'c/utils';

const parseBoolean = (obj, ...args) => {
    if (typeof obj === 'boolean') {
        return obj;
    }
    if (obj instanceof Function) {
        obj = obj.call(...args);
    }
    return !!obj;
};

const parseObject = (obj, ...args) => {
    if (obj instanceof Function) {
        obj = obj.call(...args);
    }
    return obj;
};

const parseFunction = (obj) => {
    if (obj instanceof Function) {
        return obj;
    }
    return function() {
        return obj;
    };
};

const parseFunctionFields = (obj) => {
    return Utils.fromEntries(
        Object.entries(obj).map(
            ([key, value]) => [key, parseFunction(value)]
        )
    );
};

const parseObjectFields = (obj, ...args) => {
    return Utils.fromEntries(
        Object.entries(obj).map(
            ([key, value]) => [key, parseObject(value, ...args)]
        )
    );
};

const genID = (length) => {
    return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36);
};

const parsePosition = (position, condition) => {
    return {
        isAppend: position === 'append' && condition,
        isInsertBefore: position === 'insertBefore' && condition,
        isStart: position === 'start' && condition,
        isEnd: position === 'end' && condition
    };
};

const hasChildNode = (parent, node) => {
    if (!parent.hasChildren) {
        return false;
    }
    if (parent.childNodes.find(child => child === node)) {
        return true;
    }
    return parent.childNodes.filter(child => hasChildNode(child, node)).length > 0;
};

const preOrderTraversalTree = (tree, cb) => {
    if (!tree.hasChildren || !tree.childNodes || tree.childNodes.length === 0) {
        return;
    }
    tree.childNodes.forEach(child => {
        cb.call(tree, child);
        preOrderTraversalTree(child, cb);
    });
};

const parseFuncParams = (target, fields = []) => {
    return new Proxy(target, {
        get(target, p, receiver) {
            const value = Reflect.get(target, p, receiver);
            if (fields.includes(p)) {
                return value();
            }
            return value;
        }
    });
};

export {
    parseBoolean,
    parseFunction,
    parseFunctionFields,
    parseObject,
    parseObjectFields,
    parsePosition,
    preOrderTraversalTree,
    genID,
    hasChildNode,
    parseFuncParams
};