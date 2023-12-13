import client from './ElasticSearchClient.js';
import co from 'co';
import DB from '../Util/DB.js';

export default class ElasticSearcher {
  constructor(size = 500, from = 0) {
    this._size = size;
    this._from = from;
  }

  search(keyword) {
    return co(function*(){
      const query = this._buildQuery(keyword);
      const result = yield client.search({
        index: 'esdoc',
        size: this._size,
        from: this._from,
        body: query
      });
      return yield this._formatResult(result);
    }.bind(this));
  }

  _buildQuery(keyword) {
    // fixme: validate keyword
    keyword = keyword.replace(/[^\w\d\-_ ]/g, ' ');

    const fields = [
      {name: 'name', boost: 2},
      {name: 'description', boost: 1},
      {name: 'author', boost: 1},
      {name: 'readme', boost: 1},
      {name: 'todo', boost: 1},
      {name: 'extends', boost: 1},
      {name: 'implements', boost: 1},
      {name: 'type', boost: 1},
      {name: 'return', boost: 1},
      {name: 'params', boost: 1},
      {name: 'properties', boost: 1},
      {name: 'throws', boost: 1},
      {name: 'emits', boost: 1},
      {name: 'listens', boost: 1},
      {name: 'test_targets', boost: 1}
    ];

    const should = [];
    for (let field of fields) {
      should.push({
        match: {
          [field.name]: {
            query: keyword,
            operator: 'and',
            boost: field.boost
          }
        }
      });
    }

    return {
      "query": {
        "bool": {
          "should": should
        }
      }
    }
  }

  _formatResult(result) {
    return co(this._formatResultAsync.bind(this, result));
  }

  *_formatResultAsync(result) {
    const formatted = {
      size: this._size,
      from: this._from,
      total: result.hits.total,
      hits: []
    };

    const packages = {};

    for (let hit of result.hits.hits) {
      const source = hit._source;

      const gitUrl = source.git_url;
      if (!packages[gitUrl]) {
        const record = yield DB.selectGitURL(gitUrl);
        if (record.package) {
          const packageObj = JSON.parse(record.package);
          packages[gitUrl] = packageObj.name;
        } else {
          packages[gitUrl] = gitUrl.split('/')[1];
        }
      }

      source.package = packages[gitUrl];
      formatted.hits.push(source);
    }

    return formatted;
  }
}
