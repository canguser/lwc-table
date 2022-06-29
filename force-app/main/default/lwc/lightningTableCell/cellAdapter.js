/**
 * Created by ryan on 2020/8/13.
 */
import Utils from 'c/utils';

export default class CellAdapter {

    static adaptProperty(target, origin, mapper = {}, adaptSame = true) {

        Object.entries(mapper).forEach(([chain, key]) => {
            let value = Utils.getProperty(origin, chain);
            Utils.setProperty(target, key, value);
        });

        adaptSame && Object.keys(origin).forEach(key => {
            const value = origin[key];
            if (key in target && !Object.keys(mapper).includes(key) && typeof value !== 'function') {
                target[key] = value;
            }
        });


        return target;
    }


    static TYPE_MAPPER = {
        boolean: { type: 'checkbox' },
        combobox: { type: 'text' },
        date: { type: 'date' },
        time: { type: 'time' },
        datetime: { type: 'datetime' },
        email: { type: 'email' },
        long: {
            type: 'number', option: {
                step: 1
            }
        },
        double: {
            type: 'number',
            option: {
                step: 0.01
            }
        },
        integer: {
            type: 'number', option: {
                step: 1
            }
        },
        percent: {
            type: 'number',
            option: {
                formatter: 'percent'
            }
        },
        currency: {
            type: 'number',
            option: {
                formatter: 'currency'
            }
        },
        multipicklist: { type: 'multipicklist' },
        phone: { type: 'tel' },
        picklist: { type: 'picklist' },
        reference: { type: 'reference' },
        textarea: { type: 'textarea' },
        url: { type: 'url' }
    };

}