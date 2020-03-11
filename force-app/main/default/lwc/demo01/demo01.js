import {LightningElement, track} from 'lwc';

export default class Demo01 extends LightningElement {

    @track userList = [
        {id: '1', name: 'Li Ming', age: 18},
        {id: '2', name: 'Li Han', age: 19},
        {id: '3', name: 'Li Long', age: 20},
    ];

    get rows() {
        return this.userList;
    }

    get columns() {
        return [
            {
                field: 'name',
                header: {label: 'Name'},
                cell: {
                    editable: ({row, index, rows, field}) => {
                        if (row.id === '1') {
                            return true;
                        }
                        return false;
                    }
                },
                callback: {
                    onEdit: ({cell, standard}) => {
                        return standard;
                    },
                    onEditSubmit: ({value, cell, row}) => {
                        const targetUser = this.userList.find(user => (user.id === row.id));
                        if (targetUser) {
                            targetUser.name = value;
                        }
                        return true;
                    },
                    onValueChanged({cell, row, extra}) {
                        console.log({...extra});
                    },
                }
            },
            {
                field: 'birthday',
                header: {
                    label: 'Birthday',
                },
                cell: {
                    editable: true,
                    type: 'date', // YYYY-MM-DD
                    doCompute: true,
                    computedValue: '1999-01-01'
                },
                callback: {
                    onEdit: ({cell, standard}) => {
                        console.log({...cell}, {...standard});
                        standard.editorValue = cell.value;
                        standard.editorType = 'text';
                        return standard;
                    },
                }
            },
            {
                field: 'age',
                header: {label: 'Age'}
            },
            {
                field: 'action',
                header: {label: '', width: '2rem'},
                cell: {
                    actions: [
                        {
                            icon: 'utility:delete',
                            identity: 'delete',
                            status: 'always'
                        },
                        {
                            icon: 'utility:close',
                            identity: 'close',
                            status: 'always'
                        }
                    ],
                },
                callback: {
                    onActionClick: ({field, identity, row, rows, index}) => {
                        if (identity === 'delete') {
                            const id = row.id;
                            this.userList = this.userList.filter(user => user.id !== id);
                        }
                    }
                }
            }
        ]
    }
}