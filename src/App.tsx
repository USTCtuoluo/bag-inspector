import React, { useState, useCallback } from 'react'
import lz4 from 'lz4js'
import './App.css'
import { open, TimeUtil } from 'rosbag'
import { useDropzone } from 'react-dropzone'
let topics_all = {}

const App = (props: any) => {
  const onDrop = useCallback((acceptedFiles) => {
    // Do something with the files
    const files = acceptedFiles
    parseFile(files)
  }, [])

  const process = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    parseFile(files)
  }

  const parseFile = async (files) => {
    setIsDragFile(false)
    setTopicList(new Array())
    setMsgDefinitions(new Map())
    topics_all = {}

    if (files.length === 0) {
      return
    }
    const bag = await open(files[0])

    setMetadata({
      startTime: bag.startTime,
      endTime: bag.endTime,
      duration: TimeUtil.compare(bag.endTime, bag.startTime),
    })

    const msgTypes = new Map<string, string[]>()

    interface Connection {
      topic: string
      type: string
      messageDefinition: string
      callerid: string
      md5sum: string
    }
    Object.entries<Connection>(bag.connections).forEach(([_, v]) => {
      msgTypes.set(v.topic, [v.callerid, v.type, v.md5sum, v.messageDefinition])
    })

    setMsgDefinitions(msgTypes)
    const topics = new Set<string>()
    const counter = {}

    await bag.readMessages(
      {
        noParse: true,
        decompress: {
          lz4: (buffer: Buffer, size: number) => {
            const buff = new Buffer(lz4.decompress(buffer))
            return buff
          },
        },
      },
      (res) => {
        const { topic, chunkOffset, totalChunks, timestamp } = res
        topics.add(topic)
        // 取 500 HZ 的数据
        // (timestamp.sec - bag.startTime.sec) * 500  秒 * 500
        // ((timestamp.nsec - bag.startTime.nsec) / 2000000) 纳秒除以 500
        let num = (timestamp.sec - bag.startTime.sec) * 500 + parseInt(((timestamp.nsec - bag.startTime.nsec) / 2000000) as any)
        if (topics_all[topic]) {
          let temp = topics_all[topic]
          if (temp[temp.length - 1] !== num) {
            temp.push(num)
            topics_all[topic] = temp
          }
        } else {
          let temp = new Array()
          temp.push(num)
          topics_all[topic] = temp
        }

        topics.add(topic)
        if (counter[topic]) {
          counter[topic] = counter[topic] + 1
        } else {
          counter[topic] = 1
        }

        setProgress(Math.round(((chunkOffset + 1) / totalChunks) * 100))
      }
    )
    setTopicCounter(counter)
    setTopicList(Array.from(topics).sort())
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })
  const [topicCounter, setTopicCounter] = useState<any>()
  const [isDragFile, setIsDragFile] = useState<boolean>(true)
  const [metadata, setMetadata] = useState<any>(null)
  const [topicList, setTopicList] = useState<string[]>([])
  // const [topicCounter, setTopicCounter] = useState<any>();
  const [progress, setProgress] = useState<number>(0)
  const [msgDefinitions, setMsgDefinitions] = useState<Map<string, string[]>>(new Map())

  return (
    <div>
      <div style={{ height: '1px', width: '100%' }}>
        <div className="file">
          CHOOSE BAG:
          <input type="file" accept=".bag" onChange={process}></input>
        </div>
      </div>
      {isDragFile ? (
        <div {...getRootProps()} className="dragFile" style={{ width: '100%', height: '800px', backgroundColor: '#2B2A32', textAlign: 'center', lineHeight: '800px', fontSize: '50px', color: 'white' }}>
          <input {...getInputProps()} onChange={process} />
          {isDragActive ? <p>正在拖拽bag</p> : <p>将文件拖拽到此处,或者单击此处上传bag</p>}
        </div>
      ) : (
        <>
          {' '}
          {metadata ? (
            <div className="baginfo">
              <div style={{ height: '80px' }}>
                <div className="information">
                  <hr />
                  <div>
                    <b>Start Time: </b>
                    <FormatedDateTime datetime={metadata.startTime}></FormatedDateTime>
                  </div>
                  <div>
                    <b>End Time: </b>
                    <FormatedDateTime datetime={metadata.endTime}></FormatedDateTime>
                  </div>
                  <div>
                    <b>Duration: </b>
                    {metadata.duration}s
                  </div>
                  <hr />
                </div>
              </div>
              {progress < 100 ? (
                <div style={{ padding: '20px' }}>{progress}%</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Caller ID</th>
                      <th>Message Definition</th>
                      <th>Message Definition MD5</th>
                      <th>Message Count</th>
                      <th>Message Frequency</th>
                      <th>Message Frequency Image</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicList &&
                      topicList.map((t) => (
                        <tr id={t}>
                          <td>{t}</td>
                          <td>{msgDefinitions.get(t)[0]}</td>
                          <td>
                            <span className="msgDef" title={msgDefinitions.get(t)[3]}>
                              {msgDefinitions.get(t)[1]}
                            </span>
                          </td>
                          <td>{msgDefinitions.get(t)[2]}</td>
                          <td>{topicCounter[t]}</td>
                          <td>{Math.round(topicCounter[t] / metadata.duration)}hz</td>
                          <td>
                            <div style={{ position: 'relative', height: `21px` }}>
                              {topics_all[t].map((str) => (
                                <i style={{ position: 'absolute', float: 'left', left: `${str * 0.08}px`, width: '0.08px', height: `20px`, backgroundColor: 'blue' }} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

const FormatedDateTime: React.FC<{
  datetime: { sec: number; nsec: number }
}> = (props) => <span>{`${new Date(props.datetime.sec * 1000).toLocaleString()} sec: ${props.datetime.sec} nsec: ${props.datetime.nsec}`}</span>

export default App
