import SunburstContainer from '../client/content/containers/SunburstContainer.jsx';
import Sunburst from '../client/content/components/Sunburst.jsx';

describe('SunburstContainer test', ()=>{
    let wrapper;

    const props = {
        build: [{
            timeStamp: 1575426090404,
            time: 1439,
            hash: "546142ce1b49a6ba7d6f",
            errors: [],
            size: 1172113,
            assets: [{ "name": "bundle.js", "chunks": ["main"], "size": 1172113 }],
            chunks: [{ "size": 1118609, "files": ["bundle.js"], "modules": [{ "name": "./client/App.jsx", "size": 6375, "id": "./client/App.jsx" }] }],
            treeStats: { csj: [], esm: [], both: [] }
        }],
        activeBuild: 1
    }

    beforeAll(() => {
        wrapper = shallow(<SunburstContainer {...props} />);
    });

    it('Snapshot testing SunburstContainer', () => {
        expect(toJson(wrapper)).toMatchSnapshot();
    })

    it("Should render Sunburst",()=>{
        expect(wrapper.find(Sunburst).length).toEqual(1);
    })
})