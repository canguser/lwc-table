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
    const result = {};
    for (const key of Object.keys(obj)) {
        result[key] = parseFunction(obj[key]);
    }
    return result;
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

export {
    parseBoolean,
    parseFunction,
    parseFunctionFields,
    parseObject,
    parseObjectFields,
    parsePosition,
    preOrderTraversalTree,
    genID,
    hasChildNode
};