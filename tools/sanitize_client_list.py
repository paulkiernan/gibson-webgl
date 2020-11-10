import json
import string
import random

with open('../response-2016-02-19.json') as infile:

    input_json = json.load(infile)
    for index, line in enumerate(input_json['data']):
        line['table'] = random.choice(string.printable) * len(line['table'])

with open('../sanitized_response-2016-02-19.json', 'w') as outfile:
    json.dump(input_json, outfile)
