import { LightningElement } from 'lwc';

export default class Demo01 extends LightningElement {
    get rows() {
        return [
            { name: 'Li Ming', age: 18 },
            { name: 'Li Han', age: 19 },
            { name: 'Li Long', age: 20 },
        ]
    }

    get columns() {
        return [
            {
                field: 'name',
                header: { label: 'Name' },
                cell: {
                    editable: true
                }
            },
            {
                field: 'age',
                header: { label: 'Age' }
            },
        ]
    }
}