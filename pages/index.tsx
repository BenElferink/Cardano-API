import type { NextPage } from 'next'
import Link from 'next/link'

const Page: NextPage = () => {
  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
      }}
    >
      <Link href='https://badfoxmc.com' target='_blank' rel='noopener noreferrer'>
        Cardano API 🛜 - by Bad Fox Motorcycle Club
      </Link>
    </main>
  )
}

export default Page
