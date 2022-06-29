global with sharing class LookupHelper {

    @AuraEnabled(Cacheable=true)
    global static LookupHelper.Reference[] getReferenceObject(String recordName,
            String compareFields,
            String descFields,
            String value,
            String whereCase)
    {
        LookupHelper.Reference[] references = new List<LookupHelper.Reference>();
        if (recordName == null || recordName == '')
        {
            return references;
        }
        if (compareFields == null || compareFields == '')
        {
            compareFields = 'Name';
        }
        compareFields = compareFields.replaceAll('\\s', '');
        if (String.isEmpty(descFields))
        {
            descFields = compareFields;
        }
        descFields = descFields.replaceAll('\\s', '');
        if (descFields.startsWithIgnoreCase('Name'))
        {
            descFields.replaceFirst('Name,', '');
        }
        descFields = descFields.replaceAll(',Name,', ',').replaceAll(',Name', '');
        if (descFields.equalsIgnoreCase('Name'))
        {
            descFields = '';
        }
        // parse SOQL
        String[] cFields = compareFields.split(',');
        String[] dFields = descFields.split(',');
        String[] queryFields = new String[] {'Name'};
        if (!String.isEmpty(descFields))
        {
            queryFields.addAll(dFields);
        } else
        {
            dFields = new String[] {};
        }
        String sql = 'SELECT ' + String.escapeSingleQuotes(String.join(queryFields, ', ')) + ' FROM ' + String.escapeSingleQuotes(recordName);
        if (cFields.size() >= 1)
        {
            sql += ' WHERE (';
            for (Integer i = 0; i < cFields.size(); i++)
            {
                String cField = cFields[i];
                sql += cField + ' like \'%' + value + '%\'';
                if (i != cFields.size() - 1)
                {
                    sql += ' or ';
                } else
                {
                    sql += ')';
                }
            }
        }
        // parse where case to SOQL
        if (whereCase != null && whereCase != '')
        {
            sql += 'and (' + whereCase + ')';
        }
        sql += ' limit 50';
        System.debug(sql);
        SObject[] results = Database.query(sql);
        // parse result to reference;
        for (SObject result : results)
        {
            String[] referenceDesc = new List<String>();
            for (String f : dFields)
            {
                String fValue = (String) (getFieldValue(result, f));
                if (fValue != null)
                {
                    referenceDesc.add(fValue);
                }
            }
            references.add(new LookupHelper.Reference(
                    (String) result.get('Name'),
                    (String) result.get('Id'),
                    referenceDesc));
        }
        return references;
    }

    private static Object getFieldValue(SObject sobj, String field)
    {
        if (sobj == null)
        {
            return null;
        }
        if (field.contains('.'))
        {
            String preField = field.split('\\.')[0];
            String nextField = field.removeStart(preField + '.');
            return getFieldValue(sobj.getSObject(preField), nextField);
        }
        return sobj.get(field);
    }

    @AuraEnabled(Cacheable=true)
    global static String getObjectName(String recordName,
            String id)
    {
        if (recordName == null || recordName == '' || id == null || id == '')
        {
            return '';
        }
        String sql = 'SELECT Name FROM ' + String.escapeSingleQuotes(recordName) + ' WHERE Id = \'' + String.escapeSingleQuotes(id) + '\'';
        SObject[] res = Database.query(sql);
        if (res != null && res[0] != null)
        {
            return (String) res[0].get('Name');
        } else
        {
            return '';
        }
    }

    global class Reference
    {

        global Reference(String referenceName, Id referenceId, String[] referenceDesc)
        {
            this.referenceName = referenceName;
            this.referenceId = referenceId;
            this.referenceDesc = referenceDesc;
        }

        @AuraEnabled
        global String referenceName
        {
            get;
            set;
        }
        @AuraEnabled
        global Id referenceId
        {
            get;
            set;
        }
        @AuraEnabled
        global String[] referenceDesc
        {
            get;
            set;
        }
    }
}
